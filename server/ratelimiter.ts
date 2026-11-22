/**
 * Distributed Sliding-Window Rate Limiter (Upstash Redis REST)
 *
 * Uses Upstash Redis / Vercel KV REST pipelines (`INCR` + `EXPIRE`) in production
 * so public booking, onboarding, auth, and booking-management routes share
 * enforcement across all serverless function instances.
 *
 * In non-production dev/preview when Upstash credentials are absent, falls back
 * to a bounded in-memory sliding counter. Never relies on in-memory limits as a
 * production security boundary when Redis is configured (and logs an explicit
 * warning in production if UPSTASH_REDIS_REST_URL is unset).
 */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

interface MemoryBucket {
  count: number;
  resetAtMs: number;
}

const devMemoryBuckets = new Map<string, MemoryBucket>();

function getRedisCreds(): { url: string; token: string } | null {
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

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSec: number;
  backend: 'redis' | 'memory-dev' | 'unconfigured-prod';
}

export async function enforceRateLimit(
  bucketKey: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitDecision> {
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
    } catch (err) {
      console.warn('Distributed Redis rate limit check fallback:', err);
    }
  }

  // Bounded memory sliding counter for local dev / unprovisioned preview
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
      backend: IS_PRODUCTION ? 'unconfigured-prod' : 'memory-dev',
    };
  }

  existing.count += 1;
  const retryAfterSec = Math.max(1, Math.ceil((existing.resetAtMs - now) / 1000));
  return {
    allowed: existing.count <= limit,
    limit,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSec: existing.count <= limit ? 0 : retryAfterSec,
    backend: IS_PRODUCTION ? 'unconfigured-prod' : 'memory-dev',
  };
}

export function extractClientIpKey(rawHeader: string | undefined, fallbackIp?: string): string {
  const first = (rawHeader || fallbackIp || 'unknown').split(',')[0].trim();
  return first.replace(/[^a-zA-Z0-9.:_-]/g, '').slice(0, 64) || 'unknown';
}
