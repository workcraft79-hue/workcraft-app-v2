/**
 * Distributed Sliding-Window Rate Limiter & Counter Store (Upstash Redis REST)
 *
 * Uses Upstash Redis / Vercel KV REST pipelines (`INCR` + `EXPIRE`) in production
 * so public booking, onboarding, auth, telemetry, and payment routes share
 * enforcement across all serverless function instances.
 *
 * In non-production dev when Upstash credentials are absent, falls back to a bounded
 * in-memory counter. Sensitive routes pass `{ failClosedInProd: true }` so missing
 * or unreachable Upstash Redis in production fails closed rather than silently bypassing.
 */

interface MemoryBucket {
  count: number;
  resetAtMs: number;
}

const devMemoryBuckets = new Map<string, MemoryBucket>();

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function getRedisCreds(): { url: string; token: string } | null {
  const url = (
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    ''
  )
    .trim()
    .replace(/\/+$/, '');
  const token = (
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    ''
  ).trim();
  if (!url || !token) return null;
  return { url, token };
}

export function isRateLimiterConfigured(): boolean {
  return Boolean(getRedisCreds());
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSec: number;
  backend: 'redis' | 'memory-dev' | 'unconfigured-prod';
  unavailable?: boolean;
}

export async function enforceRateLimit(
  bucketKey: string,
  limit: number,
  windowSeconds: number,
  options?: { failClosedInProd?: boolean }
): Promise<RateLimitDecision> {
  const isProd = isProductionRuntime();
  const creds = getRedisCreds();
  const safeKey = `wc:rl:${bucketKey}`;

  if (creds) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${creds.url}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', safeKey],
          ['EXPIRE', safeKey, String(windowSeconds), 'NX'],
          ['TTL', safeKey],
        ]),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = (await res.json()) as Array<{ result?: number }>;
        const currentCount = Number(data?.[0]?.result || 1);
        const ttl = Math.max(1, Number(data?.[2]?.result || windowSeconds));
        return {
          allowed: currentCount <= limit,
          limit,
          remaining: Math.max(0, limit - currentCount),
          retryAfterSec: currentCount <= limit ? 0 : ttl,
          backend: 'redis',
        };
      }
      if (isProd && options?.failClosedInProd) {
        console.error(`Upstash Redis rate-limit HTTP ${res.status}; failing closed on ${safeKey}.`);
        return {
          allowed: false,
          limit,
          remaining: 0,
          retryAfterSec: 30,
          backend: 'unconfigured-prod',
          unavailable: true,
        };
      }
    } catch (err) {
      console.warn('Distributed Redis rate limit check failed:', err);
      if (isProd && options?.failClosedInProd) {
        return {
          allowed: false,
          limit,
          remaining: 0,
          retryAfterSec: 30,
          backend: 'unconfigured-prod',
          unavailable: true,
        };
      }
    }
  } else if (isProd && options?.failClosedInProd) {
    console.error(
      `UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN missing in production; failing closed for ${safeKey}.`
    );
    return {
      allowed: false,
      limit,
      remaining: 0,
      retryAfterSec: 30,
      backend: 'unconfigured-prod',
      unavailable: true,
    };
  }

  // Bounded memory sliding counter for local dev / unprovisioned preview non-critical paths
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const existing = devMemoryBuckets.get(safeKey);
  if (!existing || existing.resetAtMs <= now) {
    if (devMemoryBuckets.size > 5000) {
      devMemoryBuckets.clear();
    }
    devMemoryBuckets.set(safeKey, { count: 1, resetAtMs: now + windowMs });
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - 1),
      retryAfterSec: 0,
      backend: isProd ? 'unconfigured-prod' : 'memory-dev',
    };
  }

  existing.count += 1;
  const retryAfterSec = Math.max(1, Math.ceil((existing.resetAtMs - now) / 1000));
  return {
    allowed: existing.count <= limit,
    limit,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSec: existing.count <= limit ? 0 : retryAfterSec,
    backend: isProd ? 'unconfigured-prod' : 'memory-dev',
  };
}

export async function getDistributedCounter(
  counterKey: string
): Promise<{ count: number; ttlSec: number } | null> {
  const creds = getRedisCreds();
  const safeKey = `wc:cnt:${counterKey}`;
  if (creds) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${creds.url}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['GET', safeKey],
          ['TTL', safeKey],
        ]),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = (await res.json()) as Array<{ result?: string | number | null }>;
        const count = Number(data?.[0]?.result || 0);
        const ttlSec = Math.max(0, Number(data?.[1]?.result || 0));
        return { count: Number.isFinite(count) ? count : 0, ttlSec };
      }
    } catch {
      // fall through
    }
  }
  const existing = devMemoryBuckets.get(safeKey);
  if (!existing || existing.resetAtMs <= Date.now()) return { count: 0, ttlSec: 0 };
  return {
    count: existing.count,
    ttlSec: Math.max(1, Math.ceil((existing.resetAtMs - Date.now()) / 1000)),
  };
}

export async function incrementDistributedCounter(
  counterKey: string,
  windowSeconds: number
): Promise<{ count: number; ttlSec: number }> {
  const creds = getRedisCreds();
  const safeKey = `wc:cnt:${counterKey}`;
  if (creds) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${creds.url}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', safeKey],
          ['EXPIRE', safeKey, String(windowSeconds)],
          ['TTL', safeKey],
        ]),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = (await res.json()) as Array<{ result?: number }>;
        return {
          count: Number(data?.[0]?.result || 1),
          ttlSec: Math.max(1, Number(data?.[2]?.result || windowSeconds)),
        };
      }
    } catch {
      // fall through
    }
  }

  const now = Date.now();
  const existing = devMemoryBuckets.get(safeKey);
  if (!existing || existing.resetAtMs <= now) {
    const next = { count: 1, resetAtMs: now + windowSeconds * 1000 };
    devMemoryBuckets.set(safeKey, next);
    return { count: 1, ttlSec: windowSeconds };
  }
  existing.count += 1;
  existing.resetAtMs = now + windowSeconds * 1000;
  return { count: existing.count, ttlSec: windowSeconds };
}

export async function deleteDistributedCounter(counterKey: string): Promise<void> {
  const creds = getRedisCreds();
  const safeKey = `wc:cnt:${counterKey}`;
  devMemoryBuckets.delete(safeKey);
  if (creds) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      await fetch(`${creds.url}/del/${encodeURIComponent(safeKey)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.token}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch {
      // ignore cleanup failure
    }
  }
}

export function extractClientIpKey(rawHeader: string | undefined, fallbackIp?: string): string {
  const first = (rawHeader || fallbackIp || 'unknown').split(',')[0].trim();
  return first.replace(/[^a-zA-Z0-9.:_-]/g, '').slice(0, 64) || 'unknown';
}
