export const AUDIT_STARTED_AT_ISO = '2026-11-18T21:14:20Z';
export const AUDIT_EXPIRES_AT_ISO = '2026-11-19T21:14:20Z';
export const AUDIT_EXPIRES_AT_MS = Date.parse(AUDIT_EXPIRES_AT_ISO);

// SHA-256 digest of the Founder Security PIN
const FOUNDER_PIN_SHA256 = 'd9c0ad4c45814b38c9f92098f09ac965c7b8000c2943c04edf140c46f32f269f';

export const FOUNDER_SESSION_STORAGE_KEY = 'wcl_founder_pin_session_v1';
export const MANUAL_LOCK_STORAGE_KEY = 'wcl_manual_lock_override_v1';

export function isAuditWindowOpen(nowMs: number = Date.now()): boolean {
  return nowMs < AUDIT_EXPIRES_AT_MS;
}

export function formatRemainingAuditTime(remainingMs: number): string {
  if (remainingMs <= 0) return '00h 00m 00s (Expired)';
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

// Pure TypeScript SHA-256 fallback so PIN verification works across both HTTPS and local HTTP contexts
function pureSha256Hex(ascii: string): string {
  const rightRotate = (value: number, amount: number) =>
    (value >>> amount) | (value << (32 - amount));

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  let input = ascii + '\x80';
  while ((input.length % 64) - 56) input += '\x00';

  for (let i = 0; i < input.length; i++) {
    const j = input.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash.unshift((temp1 + temp2) | 0);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }

    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

export async function verifyFounderPin(pinInput: string): Promise<boolean> {
  const normalized = pinInput.trim().toUpperCase();
  if (!normalized) return false;

  // Prefer server-side edge verification when hosted on Vercel
  try {
    const res = await fetch('/api/verify-founder-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: normalized }),
    });
    if (res.ok) {
      const data = (await res.json()) as { valid?: boolean };
      if (typeof data.valid === 'boolean') {
        return data.valid;
      }
    }
  } catch {
    // Fallback cleanly when running in pure Vite dev without /api routes
  }

  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoded = new TextEncoder().encode(normalized);
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
      const hex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return hex === FOUNDER_PIN_SHA256;
    }
  } catch {
    // Fallback to pure JS SHA-256
  }

  return pureSha256Hex(normalized) === FOUNDER_PIN_SHA256;
}

export interface DetectedPublicRoute {
  type: 'SALON_OWNER' | 'FIELD_AGENT' | null;
  label: string | null;
}

export function detectPublicRoleRoute(): DetectedPublicRoute {
  try {
    const search = window.location.search;
    const path = window.location.pathname;
    const hash = window.location.hash;
    const params = new URLSearchParams(search);

    const ref = params.get('ref');
    const utmSource = params.get('utm_source');
    const isSocialCampaign =
      ref === 'fb' ||
      ref === 'facebook' ||
      ref === 'ig' ||
      ref === 'instagram' ||
      ref === 'tiktok' ||
      ref === 'tt' ||
      ref === 'social' ||
      utmSource === 'facebook' ||
      utmSource === 'instagram' ||
      utmSource === 'tiktok';

    const isSalonDirectRoute =
      path.includes('/onboard') ||
      path.includes('/salon') ||
      hash.includes('onboard') ||
      params.has('onboard') ||
      params.has('salon_signup') ||
      params.get('role') === 'salon_owner' ||
      isSocialCampaign;

    if (isSalonDirectRoute) {
      return {
        type: 'SALON_OWNER',
        label: params.get('role') ? `?role=${params.get('role')}` : 'Salon Onboarding Link',
      };
    }

    const isEnrollRoute =
      path.includes('/enroll') ||
      hash.includes('enroll') ||
      params.has('enroll') ||
      params.get('role') === 'agent' ||
      (params.has('id') && (params.has('pin') || params.has('auth')));

    if (isEnrollRoute) {
      return {
        type: 'FIELD_AGENT',
        label: params.get('role') ? `?role=${params.get('role')}` : 'Field Agent Link',
      };
    }
  } catch {
    // Ignore URL errors
  }

  return { type: null, label: null };
}
