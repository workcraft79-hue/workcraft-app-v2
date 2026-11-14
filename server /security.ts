import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { NextFunction, Request, Response } from 'express';
import type { AuthRole, AuthUser, DevTestAccount } from '../src/types/auth';

export const SESSION_COOKIE_NAME = 'wc_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_MAX_ATTEMPTS = 5;

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Fail closed in production if JWT_SECRET is omitted; generate CSPRNG ephemeral secret in dev.
const RUNTIME_JWT_SECRET: string = (() => {
  const configured = (process.env.JWT_SECRET || '').trim();
  if (configured.length >= 32) return configured;
  if (IS_PRODUCTION) {
    if (!configured) {
      throw new Error('FATAL: JWT_SECRET environment variable must be set in production.');
    }
    return configured;
  }
  return configured || crypto.randomBytes(32).toString('hex');
})();

const RUNTIME_WEBHOOK_SECRET: string = (() => {
  const configured = (process.env.WORKCRAFT_WEBHOOK_SECRET || '').trim();
  if (configured) return configured;
  if (IS_PRODUCTION) return '';
  // Ephemeral server-only secret for dev environment; never sent to browser JS
  return crypto.randomBytes(24).toString('hex');
})();

export interface AuthJwtClaims {
  sub: string;
  user_role: AuthRole;
  salon_id: string | null;
  agent_id: string | null;
  display_name: string;
  email: string;
  phone: string;
  salon_name?: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
}

interface StoredUserRecord extends AuthUser {
  badge: string;
}

// Authoritative server-side user & tenant binding registry
const USER_DIRECTORY: StoredUserRecord[] = [
  {
    userId: 'usr-founder-1',
    userRole: 'FOUNDER',
    displayName: 'Farhan Abid',
    email: 'farhanabidraja1979@gmail.com',
    phone: '+92 300 0000001',
    salonId: null,
    agentId: null,
    badge: 'Founder · All Tenants',
  },
  {
    userId: 'usr-agent-pk-1',
    userRole: 'AGENT',
    displayName: 'Kamran Sheikh',
    email: 'kamran@workcraft.local',
    phone: '+92 301 7788990',
    salonId: null,
    agentId: 'agent-pk-1',
    badge: 'Field Agent · PK (Lahore / Karachi)',
  },
  {
    userId: 'usr-agent-ae-1',
    userRole: 'AGENT',
    displayName: 'Tariq Al-Mansoor',
    email: 'tariq.uae@workcraft.local',
    phone: '+971 50 4455667',
    salonId: null,
    agentId: 'agent-ae-1',
    badge: 'Field Agent · UAE / MENA',
  },
  {
    userId: 'usr-salon-1',
    userRole: 'SALON_OWNER',
    displayName: 'Hamza Malik',
    email: 'hamza@sevencuts.pk',
    phone: '+92 321 8472910',
    salonId: '1',
    agentId: 'agent-pk-1',
    salonName: 'Seven Cuts Studio',
    badge: 'Salon #1 · Seven Cuts Studio (PRO++)',
  },
  {
    userId: 'usr-salon-2',
    userRole: 'SALON_OWNER',
    displayName: 'Tariq Butt',
    email: 'tariq@royalfade.pk',
    phone: '+92 300 9876543',
    salonId: '2',
    agentId: 'agent-pk-1',
    salonName: 'Royal Fade Lounge',
    badge: 'Salon #2 · Royal Fade Lounge (STARTER)',
  },
  {
    userId: 'usr-salon-3',
    userRole: 'SALON_OWNER',
    displayName: 'Aslam Khan',
    email: 'aslam@alnoor.ae',
    phone: '+971 50 8923411',
    salonId: '3',
    agentId: 'agent-ae-1',
    salonName: 'Al-Noor Executive Grooming',
    badge: 'Salon #3 · Al-Noor Grooming (UAE PRO++)',
  },
  {
    userId: 'usr-salon-4',
    userRole: 'SALON_OWNER',
    displayName: 'Oliver Bennett',
    email: 'oliver@mayfairblade.co.uk',
    phone: '+44 7911 123456',
    salonId: '4',
    agentId: 'agent-uk-1',
    salonName: 'Mayfair Blade & Beard',
    badge: 'Salon #4 · Mayfair Blade (UK STARTER)',
  },
  {
    userId: 'usr-salon-5',
    userRole: 'SALON_OWNER',
    displayName: 'Ayesha Siddiqui',
    email: 'ayesha@noorbeauty.pk',
    phone: '+92 333 4412345',
    salonId: '5',
    agentId: 'agent-pk-1',
    salonName: 'Noor Beauty Lounge (Ladies Parlor)',
    badge: 'Salon #5 · Noor Beauty Lounge (PRO)',
  },
];

// Authoritative salon -> assigned_agent_id mapping for tenant RLS enforcement
const SALON_AGENT_ASSIGNMENTS = new Map<string, string>([
  ['1', 'agent-pk-1'],
  ['2', 'agent-pk-1'],
  ['3', 'agent-ae-1'],
  ['4', 'agent-uk-1'],
  ['5', 'agent-pk-1'],
]);

const AUTH_DATA_DIR = path.resolve(process.cwd(), '.data');
const AUTH_USERS_FILE = path.join(AUTH_DATA_DIR, 'auth-users.json');

function loadPersistedDynamicUsers() {
  try {
    if (!fs.existsSync(AUTH_USERS_FILE)) return;
    const raw = fs.readFileSync(AUTH_USERS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as {
      users?: StoredUserRecord[];
      assignments?: Array<[string, string]>;
    };
    if (Array.isArray(parsed.users)) {
      for (const u of parsed.users) {
        if (u?.userId && !USER_DIRECTORY.some((e) => e.userId === u.userId)) {
          USER_DIRECTORY.push(u);
        }
      }
    }
    if (Array.isArray(parsed.assignments)) {
      for (const [salonId, agentId] of parsed.assignments) {
        if (salonId && agentId) {
          SALON_AGENT_ASSIGNMENTS.set(salonId, agentId);
        }
      }
    }
  } catch {
    // Ignore corrupt cache and boot cleanly from seeded directory
  }
}

function persistDynamicUsers() {
  try {
    if (!fs.existsSync(AUTH_DATA_DIR)) {
      fs.mkdirSync(AUTH_DATA_DIR, { recursive: true });
    }
    const dynamicUsers = USER_DIRECTORY.filter((u) => u.userId.startsWith('usr-onboard-'));
    const assignments = Array.from(SALON_AGENT_ASSIGNMENTS.entries());
    fs.writeFileSync(
      AUTH_USERS_FILE,
      JSON.stringify({ users: dynamicUsers, assignments }, null, 2),
      'utf8'
    );
  } catch (err) {
    console.warn('Could not persist dynamic auth users:', err);
  }
}

loadPersistedDynamicUsers();

export function registerSalonAssignment(salonId: string, agentId: string | null) {
  if (salonId && agentId) {
    SALON_AGENT_ASSIGNMENTS.set(salonId, agentId);
    persistDynamicUsers();
  }
}

export function registerSalonOwnerAccount(params: {
  salonId: string;
  salonName: string;
  ownerName: string;
  phone: string;
  agentId?: string | null;
}): { ok: true; user: AuthUser } | { ok: false; error: string } {
  const cleanPhone = sanitizePhone(params.phone);
  const digits = normalizePhoneDigits(cleanPhone);
  if (digits.length < 7) {
    return { ok: false, error: 'A valid WhatsApp phone number is required.' };
  }

  // Block hijacking an existing registered phone number belonging to another account
  const existing = findUserByIdentifier(cleanPhone);
  if (existing) {
    return {
      ok: false,
      error: 'This WhatsApp number is already registered. Please sign in with OTP.',
    };
  }

  const cleanSalonName = sanitizePlainText(params.salonName, 100) || 'Partner Salon';
  const cleanOwnerName = sanitizePlainText(params.ownerName, 80) || 'Salon Owner';
  const newUser: StoredUserRecord = {
    userId: `usr-onboard-${params.salonId}`,
    userRole: 'SALON_OWNER',
    displayName: cleanOwnerName,
    email: `${params.salonId}@salon.workcraft.local`,
    phone: cleanPhone,
    salonId: params.salonId,
    agentId: params.agentId ?? null,
    salonName: cleanSalonName,
    badge: `Onboarded · ${cleanSalonName}`,
  };
  USER_DIRECTORY.push(newUser);
  if (params.agentId) {
    SALON_AGENT_ASSIGNMENTS.set(params.salonId, params.agentId);
  }
  persistDynamicUsers();

  return {
    ok: true,
    user: {
      userId: newUser.userId,
      userRole: newUser.userRole,
      displayName: newUser.displayName,
      email: newUser.email,
      phone: newUser.phone,
      salonId: newUser.salonId,
      agentId: newUser.agentId,
      salonName: newUser.salonName,
    },
  };
}

export function getSalonsAssignedToAgent(agentId: string): string[] {
  const ids: string[] = [];
  for (const [salonId, assigned] of SALON_AGENT_ASSIGNMENTS.entries()) {
    if (assigned === agentId) ids.push(salonId);
  }
  return ids;
}

export function isSalonAssignedToAgent(salonId: string, agentId: string | null): boolean {
  if (!agentId) return false;
  return SALON_AGENT_ASSIGNMENTS.get(salonId) === agentId;
}

// -----------------------------------------------------------------------------
// Input Sanitization & Validation Helpers (Zero XSS / Script / Control Injection)
// -----------------------------------------------------------------------------

export function sanitizePlainText(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return '';
  let cleaned = value
    // Strip <script> / <style> blocks with contents first
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    // Strip remaining HTML/XML tags
    .replace(/<[^>]*>/g, ' ')
    // Remove ASCII control characters except common whitespace (\n, \t)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    // Strip dangerous javascript: / data: inline schemes if passed raw
    .replace(/\b(?:javascript|vbscript|data):/gi, '')
    .trim();

  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength).trim();
  }
  return cleaned;
}

export function sanitizeMultilineTemplate(value: unknown, maxLength = 600): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\b(?:javascript|vbscript|data):/gi, '')
    .trim()
    .slice(0, maxLength);
}

export function sanitizePhone(value: unknown, maxLength = 24): string {
  if (typeof value !== 'string') return '';
  const cleaned = value.replace(/[^\d+\-\s()]/g, '').trim().slice(0, maxLength);
  return cleaned;
}

export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function sanitizeBirthDate(value: unknown): string {
  if (typeof value !== 'string') return '';
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return '';
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return '';
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

export function sanitizeHttpUrl(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return fallback;
    }
    return parsed.toString().slice(0, 300);
  } catch {
    return fallback;
  }
}

export function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

// -----------------------------------------------------------------------------
// HS256 Signed JWT Session Helpers (Node built-in crypto, zero dependencies)
// -----------------------------------------------------------------------------

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64');
}

export function signSessionToken(user: AuthUser): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadObj: AuthJwtClaims = {
    sub: user.userId,
    user_role: user.userRole,
    salon_id: user.salonId,
    agent_id: user.agentId,
    display_name: user.displayName,
    email: user.email,
    phone: user.phone,
    salon_name: user.salonName,
    iat: nowSec,
    exp: nowSec + SESSION_TTL_SECONDS,
  };
  const payload = base64UrlEncode(JSON.stringify(payloadObj));
  const data = `${header}.${payload}`;
  const sig = base64UrlEncode(
    crypto.createHmac('sha256', RUNTIME_JWT_SECRET).update(data).digest()
  );
  return `${data}.${sig}`;
}

export function verifySessionToken(token: string): AuthUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const data = `${headerB64}.${payloadB64}`;
    const expectedSig = base64UrlEncode(
      crypto.createHmac('sha256', RUNTIME_JWT_SECRET).update(data).digest()
    );
    const sigBuf = Buffer.from(sigB64);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const claims = JSON.parse(base64UrlDecode(payloadB64).toString('utf8')) as AuthJwtClaims;
    const nowSec = Math.floor(Date.now() / 1000);
    if (!claims.sub || !claims.user_role || !claims.exp || claims.exp < nowSec) {
      return null;
    }

    return {
      userId: claims.sub,
      userRole: claims.user_role,
      displayName: claims.display_name,
      email: claims.email,
      phone: claims.phone,
      salonId: claims.salon_id ?? null,
      agentId: claims.agent_id ?? null,
      salonName: claims.salon_name,
    };
  } catch {
    return null;
  }
}

export function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}

export function setSessionCookie(res: Response, token: string, req?: Request) {
  const isHttps =
    req?.secure || req?.header('x-forwarded-proto') === 'https' || IS_PRODUCTION;
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (isHttps) {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res: Response) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

// -----------------------------------------------------------------------------
// Email / Phone Lookup & 6-Digit OTP Verification Store
// -----------------------------------------------------------------------------

interface OtpChallenge {
  userId: string;
  otpHash: string;
  expiresAtMs: number;
  attempts: number;
}

const otpChallenges = new Map<string, OtpChallenge>();

function hashOtp(identifierKey: string, otp: string): string {
  return crypto
    .createHmac('sha256', RUNTIME_JWT_SECRET)
    .update(`${identifierKey}:${otp}`)
    .digest('hex');
}

export function findUserByIdentifier(rawIdentifier: string): StoredUserRecord | null {
  const cleaned = sanitizePlainText(rawIdentifier, 120);
  if (!cleaned) return null;

  const lowerEmail = cleaned.toLowerCase();
  if (lowerEmail.includes('@')) {
    return USER_DIRECTORY.find((u) => u.email.toLowerCase() === lowerEmail) || null;
  }

  const digits = normalizePhoneDigits(cleaned);
  if (digits.length < 7) return null;

  return (
    USER_DIRECTORY.find((u) => {
      const uDigits = normalizePhoneDigits(u.phone);
      return (
        uDigits === digits ||
        (digits.length >= 9 && uDigits.endsWith(digits.slice(-9)))
      );
    }) || null
  );
}

export function findUserById(userId: string): StoredUserRecord | null {
  return USER_DIRECTORY.find((u) => u.userId === userId) || null;
}

export function getDevTestAccounts(): DevTestAccount[] {
  if (process.env.NODE_ENV !== 'development') return [];
  return USER_DIRECTORY.map((u) => ({
    userId: u.userId,
    userRole: u.userRole,
    displayName: u.displayName,
    email: u.email,
    phone: u.phone,
    salonId: u.salonId,
    agentId: u.agentId,
    salonName: u.salonName,
    badge: u.badge,
  }));
}

export function createOtpChallenge(rawIdentifier: string): {
  ok: true;
  user: AuthUser;
  maskedTarget: string;
  devOtpPreview?: string;
} | {
  ok: false;
  error: string;
} {
  const user = findUserByIdentifier(rawIdentifier);
  if (!user) {
    return {
      ok: false,
      error: 'No registered WORKCRAFT account found for that email or WhatsApp phone.',
    };
  }

  const code = String(crypto.randomInt(100000, 1000000));
  const key = user.userId;
  otpChallenges.set(key, {
    userId: user.userId,
    otpHash: hashOtp(key, code),
    expiresAtMs: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });

  const maskedTarget = rawIdentifier.includes('@')
    ? user.email.replace(/(^.{2})[^@]*(@.*$)/, '$1***$2')
    : `${user.phone.slice(0, 6)}••••${user.phone.slice(-3)}`;

  const publicUser: AuthUser = {
    userId: user.userId,
    userRole: user.userRole,
    displayName: user.displayName,
    email: user.email,
    phone: user.phone,
    salonId: user.salonId,
    agentId: user.agentId,
    salonName: user.salonName,
  };

  // Never expose OTP codes in production HTTP responses
  if (process.env.NODE_ENV === 'development') {
    return { ok: true, user: publicUser, maskedTarget, devOtpPreview: code };
  }
  return { ok: true, user: publicUser, maskedTarget };
}

export function verifyOtpChallenge(
  rawIdentifier: string,
  rawOtp: string
): { ok: true; user: AuthUser } | { ok: false; error: string } {
  const user = findUserByIdentifier(rawIdentifier);
  if (!user) {
    return { ok: false, error: 'Invalid credentials or expired verification code.' };
  }
  const challenge = otpChallenges.get(user.userId);
  if (!challenge) {
    return { ok: false, error: 'No active OTP challenge. Please request a new code.' };
  }
  if (Date.now() > challenge.expiresAtMs) {
    otpChallenges.delete(user.userId);
    return { ok: false, error: 'Verification code expired. Please request a new code.' };
  }
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    otpChallenges.delete(user.userId);
    return { ok: false, error: 'Too many invalid attempts. Please request a new code.' };
  }

  const cleanOtp = String(rawOtp || '').replace(/\D/g, '').slice(0, 6);
  if (cleanOtp.length !== 6) {
    challenge.attempts += 1;
    return { ok: false, error: 'Please enter the 6-digit verification code.' };
  }

  const candidateHash = hashOtp(user.userId, cleanOtp);
  const a = Buffer.from(candidateHash, 'hex');
  const b = Buffer.from(challenge.otpHash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    challenge.attempts += 1;
    return { ok: false, error: 'Incorrect verification code. Please check and try again.' };
  }

  otpChallenges.delete(user.userId);
  return {
    ok: true,
    user: {
      userId: user.userId,
      userRole: user.userRole,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone,
      salonId: user.salonId,
      agentId: user.agentId,
      salonName: user.salonName,
    },
  };
}

// -----------------------------------------------------------------------------
// Express Auth & Tenant Isolation Middleware
// -----------------------------------------------------------------------------

export function extractAuthUserFromRequest(req: Request): AuthUser | null {
  const authHeader = req.header('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    const verified = verifySessionToken(bearer);
    if (verified) return verified;
  }

  const cookies = parseCookieHeader(req.header('cookie'));
  const sessionCookie = cookies[SESSION_COOKIE_NAME];
  if (sessionCookie) {
    return verifySessionToken(sessionCookie);
  }
  return null;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = extractAuthUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  req.authUser = user;
  return next();
}

export function requireRole(...allowedRoles: AuthRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.authUser;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(user.userRole)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role privileges.' });
    }
    return next();
  };
}

export function requireSalonTenantAccess(allowAgentReadOnly = false) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.authUser;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const requestedSalonId = String(req.params.salonId || '').trim();
    if (!requestedSalonId) {
      return res.status(400).json({ error: 'salonId is required.' });
    }

    if (user.userRole === 'FOUNDER') {
      return next();
    }

    if (user.userRole === 'SALON_OWNER') {
      if (user.salonId !== requestedSalonId) {
        return res.status(403).json({
          error: 'Forbidden: tenant isolation blocks cross-salon access.',
        });
      }
      return next();
    }

    if (user.userRole === 'AGENT') {
      if (!allowAgentReadOnly) {
        return res.status(403).json({
          error: 'Forbidden: field agents cannot mutate live salon owner operational tables.',
        });
      }
      if (!isSalonAssignedToAgent(requestedSalonId, user.agentId)) {
        return res.status(403).json({
          error: 'Forbidden: salon is not assigned to your agent_id.',
        });
      }
      return next();
    }

    return res.status(403).json({ error: 'Forbidden.' });
  };
}

// -----------------------------------------------------------------------------
// Webhook Header Secret Check & Per-Number Rate Limiter
// -----------------------------------------------------------------------------

export function requireWebhookSecret(req: Request, res: Response, next: NextFunction) {
  if (!RUNTIME_WEBHOOK_SECRET) {
    return res.status(503).json({
      error: 'Webhook secret not configured on server (WORKCRAFT_WEBHOOK_SECRET).',
    });
  }

  const provided = (req.header('x-workcraft-webhook-secret') || '').trim();
  if (!provided) {
    return res.status(401).json({
      error: 'Unauthorized: missing x-workcraft-webhook-secret header.',
    });
  }

  const providedHash = crypto.createHash('sha256').update(provided).digest();
  const expectedHash = crypto.createHash('sha256').update(RUNTIME_WEBHOOK_SECRET).digest();
  if (!crypto.timingSafeEqual(providedHash, expectedHash)) {
    return res.status(401).json({
      error: 'Unauthorized: invalid x-workcraft-webhook-secret header.',
    });
  }

  return next();
}

interface RateBucket {
  timestamps: number[];
}

export function createWebhookRateLimiter(options?: {
  windowMs?: number;
  maxPerPhone?: number;
  maxPerIp?: number;
}) {
  const windowMs = options?.windowMs ?? 60_000;
  const maxPerPhone = options?.maxPerPhone ?? 15;
  const maxPerIp = options?.maxPerIp ?? 60;
  const buckets = new Map<string, RateBucket>();

  const checkBucket = (key: string, limit: number, now: number): { allowed: boolean; retryAfterSec: number } => {
    const existing = buckets.get(key) || { timestamps: [] };
    existing.timestamps = existing.timestamps.filter((t) => now - t < windowMs);
    if (existing.timestamps.length >= limit) {
      const oldest = existing.timestamps[0] || now;
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
      buckets.set(key, existing);
      return { allowed: false, retryAfterSec };
    }
    existing.timestamps.push(now);
    buckets.set(key, existing);
    return { allowed: true, retryAfterSec: 0 };
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const rawPhone = typeof req.body?.fromPhone === 'string' ? req.body.fromPhone : '';
    const normPhone = normalizePhoneDigits(rawPhone);
    const clientIp = String(req.ip || req.socket.remoteAddress || 'unknown');

    if (normPhone) {
      const phoneCheck = checkBucket(`phone:${normPhone}`, maxPerPhone, now);
      if (!phoneCheck.allowed) {
        res.setHeader('Retry-After', String(phoneCheck.retryAfterSec));
        return res.status(429).json({
          error: 'Rate limit exceeded for this WhatsApp phone number. Please retry shortly.',
          retryAfterSec: phoneCheck.retryAfterSec,
        });
      }
    }

    const ipCheck = checkBucket(`ip:${clientIp}`, maxPerIp, now);
    if (!ipCheck.allowed) {
      res.setHeader('Retry-After', String(ipCheck.retryAfterSec));
      return res.status(429).json({
        error: 'Rate limit exceeded from this source IP. Please retry shortly.',
        retryAfterSec: ipCheck.retryAfterSec,
      });
    }

    return next();
  };
}
