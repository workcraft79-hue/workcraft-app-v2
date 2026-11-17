/**
 * Zero-Dependency $0.00 REST Persistence & Founder Alert Bridge
 *
 * Supports:
 * 1) Vercel KV (KV_REST_API_URL + KV_REST_API_TOKEN) or Upstash Redis Free Tier
 *    (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) via native fetch().
 * 2) Optional Founder Alert Webhook (FOUNDER_ALERT_WEBHOOK_URL) for Slack / Discord /
 *    Make / n8n / Telegram webhook notifications on critical incidents.
 *
 * When env vars are absent, all operations no-op gracefully and the server runs
 * against local `.data/` (dev) or `/tmp/workcraft-data` (serverless) at $0.00 cost.
 */

function getKvCredentials(): { url: string; token: string } | null {
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

export function isKvConfigured(): boolean {
  return getKvCredentials() !== null;
}

export async function kvGetJson<T>(key: string): Promise<T | null> {
  const creds = getKvCredentials();
  if (!creds) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${creds.url}/get/${encodeURIComponent(key)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${creds.token}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: unknown };
    if (data?.result === null || data?.result === undefined) return null;
    if (typeof data.result === 'string') {
      return JSON.parse(data.result) as T;
    }
    return data.result as T;
  } catch {
    return null;
  }
}

export async function kvSetJson(key: string, value: unknown): Promise<boolean> {
  const creds = getKvCredentials();
  if (!creds) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(creds.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['SET', key, JSON.stringify(value)]),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export async function dispatchFounderAlertWebhook(payload: {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'CRITICAL';
  role: string;
  area: string;
  route?: string;
  message: string;
  resolutionStatus: string;
  recoveryMs?: number;
  occurredAt: string;
}): Promise<boolean> {
  const webhookUrl = (process.env.FOUNDER_ALERT_WEBHOOK_URL || '').trim();
  if (!webhookUrl || !/^https?:\/\//i.test(webhookUrl)) {
    return false;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const summaryText = `[WorkCraft ${payload.severity}] ${payload.role} · ${payload.area} -> ${payload.message} (${payload.resolutionStatus}${payload.recoveryMs ? ` in ${payload.recoveryMs}ms` : ''})`;
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: summaryText,
        content: summaryText,
        event: 'workcraft.incident',
        ...payload,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}
