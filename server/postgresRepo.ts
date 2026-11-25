/**
 * Managed PostgreSQL Repository & Transactional Booking Guard
 *
 * Uses `pg` Pool when DATABASE_URL / POSTGRES_URL is configured.
 * Provides:
 *  - Mandatory fail-closed transaction-local RLS GUC context (`set_config(..., true)` immediately after `BEGIN`)
 *  - Server-derived actor validation (`FOUNDER`, `SALON_OWNER`, `AGENT`, `PUBLIC_FLOW`)
 *  - Transactional booking inserts with Postgres exclusion constraint handling (`23P01`)
 *  - Idempotency key deduplication
 *  - Atomic monthly booking quota updates (`salon_usage_monthly`)
 *  - Revocable signed access tokens (`booking_access_tokens`) and `booking_audit_log`
 *  - Fail-closed production behavior (never silently swallows DB/RLS failures as `{ ok: true }`)
 */

import { Pool, type PoolClient } from 'pg';
import type { AuthUser } from '../src/types/auth.js';

declare global {
  var _workcraftPgPool: Pool | undefined;
  var _workcraftPgPoolUrl: string | undefined;
  var _workcraftPgTestPoolOverride: Pool | null | undefined;
}

export type PgActorRole = 'FOUNDER' | 'AGENT' | 'SALON_OWNER' | 'PUBLIC_FLOW';

export interface PgActorContext {
  role: PgActorRole;
  salonId?: string | null;
  agentId?: string | null;
  userId?: string | null;
}

export type PgContextErrorCode =
  | 'MISSING_IDENTITY'
  | 'INVALID_CONTEXT'
  | 'FORBIDDEN_TENANT'
  | 'PRIVILEGE_ESCALATION';

export class PgContextError extends Error {
  public readonly code: PgContextErrorCode;

  constructor(code: PgContextErrorCode, message: string) {
    super(message);
    this.name = 'PgContextError';
    this.code = code;
  }
}

export interface NormalizedPgActorContext {
  role: PgActorRole;
  salonId: string;
  agentId: string;
  userId: string;
}

const PUBLIC_LOOKUP_CONTEXTS = new WeakSet<PgActorContext>();
const ACTIVE_TX_ROLES = new WeakMap<PoolClient, PgActorRole>();

function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function getDatabaseUrl(): string {
  const primary = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
  if (primary) return primary;
  if (!isProductionEnv()) {
    return (process.env.STAGING_DATABASE_URL || '').trim();
  }
  return '';
}

export function isPostgresConfigured(): boolean {
  if (!isProductionEnv() && global._workcraftPgTestPoolOverride) {
    return true;
  }
  return Boolean(getDatabaseUrl());
}

export function assertProductionDatabaseReady(): { ok: true } | { ok: false; error: string } {
  if (isProductionEnv() && !isPostgresConfigured()) {
    return {
      ok: false,
      error:
        'DATABASE_URL (managed PostgreSQL) is required in production. Ephemeral JSON/tmp storage is disabled in production.',
    };
  }
  return { ok: true };
}

/**
 * Non-production test helper for injecting a mock Pool without connecting to Neon.
 * Fails closed if invoked when NODE_ENV === 'production'.
 */
export function setPgPoolOverrideForTests(pool: Pool | null): void {
  if (isProductionEnv()) {
    throw new PgContextError(
      'PRIVILEGE_ESCALATION',
      'Test pool override cannot be used in production.'
    );
  }
  global._workcraftPgTestPoolOverride = pool;
}

function getPgPool(): Pool | null {
  if (!isProductionEnv() && global._workcraftPgTestPoolOverride) {
    return global._workcraftPgTestPoolOverride;
  }
  const connectionString = getDatabaseUrl();
  if (!connectionString) return null;
  if (!global._workcraftPgPool || global._workcraftPgPoolUrl !== connectionString) {
    global._workcraftPgPool = new Pool({
      connectionString,
      max: process.env.VERCEL ? 2 : 10,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
      ssl:
        /localhost|127\.0\.0\.1/i.test(connectionString)
          ? undefined
          : { rejectUnauthorized: false },
    });
    global._workcraftPgPoolUrl = connectionString;
    global._workcraftPgPool.on('error', (err) => {
      console.error('PostgreSQL pool idle error:', err);
    });
  }
  return global._workcraftPgPool;
}

function cleanActorId(value: unknown, fieldName: string): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') {
    throw new PgContextError(
      'INVALID_CONTEXT',
      `PostgreSQL actor ${fieldName} must be a string.`
    );
  }
  if (/[\x00-\x1f\x7f]/.test(value)) {
    throw new PgContextError(
      'INVALID_CONTEXT',
      `PostgreSQL actor ${fieldName} contains disallowed control characters.`
    );
  }
  const trimmed = value.trim();
  if (trimmed.length > 128) {
    throw new PgContextError(
      'INVALID_CONTEXT',
      `PostgreSQL actor ${fieldName} exceeds maximum allowed length.`
    );
  }
  return trimmed;
}

export function validatePgActorContext(ctx: unknown): NormalizedPgActorContext {
  if (!ctx || typeof ctx !== 'object') {
    throw new PgContextError(
      'MISSING_IDENTITY',
      'PostgreSQL transaction rejected: verified actor context is required.'
    );
  }

  const candidate = ctx as PgActorContext;
  const role = candidate.role;
  if (
    role !== 'FOUNDER' &&
    role !== 'AGENT' &&
    role !== 'SALON_OWNER' &&
    role !== 'PUBLIC_FLOW'
  ) {
    throw new PgContextError(
      'INVALID_CONTEXT',
      `PostgreSQL transaction rejected: unsupported actor role "${String(role)}".`
    );
  }

  const salonId = cleanActorId(candidate.salonId, 'salonId');
  const agentId = cleanActorId(candidate.agentId, 'agentId');
  const userId = cleanActorId(candidate.userId, 'userId');

  if (role === 'FOUNDER') {
    if (!userId) {
      throw new PgContextError(
        'MISSING_IDENTITY',
        'FOUNDER transaction rejected: verified userId is required.'
      );
    }
    if (agentId) {
      throw new PgContextError(
        'INVALID_CONTEXT',
        'FOUNDER transaction cannot carry an agentId.'
      );
    }
    return { role: 'FOUNDER', salonId: '', agentId: '', userId };
  }

  if (role === 'SALON_OWNER') {
    if (!userId || !salonId) {
      throw new PgContextError(
        'MISSING_IDENTITY',
        'SALON_OWNER transaction rejected: verified userId and salonId are required.'
      );
    }
    if (agentId) {
      throw new PgContextError(
        'INVALID_CONTEXT',
        'SALON_OWNER transaction cannot carry an agentId.'
      );
    }
    return { role: 'SALON_OWNER', salonId, agentId: '', userId };
  }

  if (role === 'AGENT') {
    if (!userId || !agentId) {
      throw new PgContextError(
        'MISSING_IDENTITY',
        'AGENT transaction rejected: verified userId and agentId are required.'
      );
    }
    if (salonId) {
      throw new PgContextError(
        'INVALID_CONTEXT',
        'AGENT transaction cannot carry a salonId.'
      );
    }
    return { role: 'AGENT', salonId: '', agentId, userId };
  }

  // PUBLIC_FLOW
  if (userId || agentId) {
    throw new PgContextError(
      'PRIVILEGE_ESCALATION',
      'PUBLIC_FLOW transaction cannot carry userId or agentId.'
    );
  }
  if (!salonId && !PUBLIC_LOOKUP_CONTEXTS.has(candidate)) {
    throw new PgContextError(
      'MISSING_IDENTITY',
      'PUBLIC_FLOW transaction requires a resolved salonId or createPublicFlowLookupActor().'
    );
  }
  return { role: 'PUBLIC_FLOW', salonId, agentId: '', userId: '' };
}

/**
 * Trusted server-side derivation of PostgreSQL RLS actor context from a verified AuthUser.
 * Never reads client-supplied role/tenant/agent/user fields.
 */
export function derivePgActorFromAuthUser(
  authUser: AuthUser | null | undefined,
  options?: { targetSalonId?: string | null }
): PgActorContext {
  if (!authUser || typeof authUser !== 'object') {
    throw new PgContextError(
      'MISSING_IDENTITY',
      'Authenticated user session is required for PostgreSQL transaction.'
    );
  }

  const userId = cleanActorId(authUser.userId, 'userId');
  if (!userId) {
    throw new PgContextError(
      'MISSING_IDENTITY',
      'Authenticated session missing verified userId.'
    );
  }

  const role = authUser.userRole;
  const targetSalonId = cleanActorId(options?.targetSalonId, 'targetSalonId');

  if (role === 'FOUNDER') {
    return Object.freeze({
      role: 'FOUNDER',
      salonId: null,
      agentId: null,
      userId,
    });
  }

  if (role === 'SALON_OWNER') {
    const allowedSalons = new Set<string>();
    const primarySalon = cleanActorId(authUser.salonId, 'salonId');
    if (primarySalon) allowedSalons.add(primarySalon);
    if (Array.isArray(authUser.allowedSalonIds)) {
      for (const s of authUser.allowedSalonIds) {
        const cleaned = cleanActorId(s, 'allowedSalonIds[]');
        if (cleaned) allowedSalons.add(cleaned);
      }
    }
    if (allowedSalons.size === 0) {
      throw new PgContextError(
        'MISSING_IDENTITY',
        'SALON_OWNER session has no assigned salonId.'
      );
    }

    const resolvedSalonId = targetSalonId || primarySalon || Array.from(allowedSalons)[0];
    if (!allowedSalons.has(resolvedSalonId)) {
      throw new PgContextError(
        'FORBIDDEN_TENANT',
        `SALON_OWNER (${userId}) is not authorized for salon ${resolvedSalonId}.`
      );
    }

    return Object.freeze({
      role: 'SALON_OWNER',
      salonId: resolvedSalonId,
      agentId: null,
      userId,
    });
  }

  if (role === 'AGENT') {
    const agentId = cleanActorId(authUser.agentId, 'agentId');
    if (!agentId) {
      throw new PgContextError(
        'MISSING_IDENTITY',
        'AGENT session missing verified agentId.'
      );
    }
    return Object.freeze({
      role: 'AGENT',
      salonId: null,
      agentId,
      userId,
    });
  }

  throw new PgContextError(
    'INVALID_CONTEXT',
    `Unsupported authenticated role "${String(role)}".`
  );
}

/**
 * Trusted server-side constructor for initial unauthenticated public_code -> salons.id lookup.
 * Sets role = 'PUBLIC_FLOW' with empty salon/agent/user GUCs.
 */
export function createPublicFlowLookupActor(): PgActorContext {
  const ctx: PgActorContext = Object.freeze({
    role: 'PUBLIC_FLOW',
    salonId: null,
    agentId: null,
    userId: null,
  });
  PUBLIC_LOOKUP_CONTEXTS.add(ctx);
  return ctx;
}

/**
 * Trusted server-side constructor for tenant-scoped PUBLIC_FLOW operations after resolving salons.id.
 */
export function createPublicFlowSalonActor(salonId: string): PgActorContext {
  const cleanSalonId = cleanActorId(salonId, 'salonId');
  if (!cleanSalonId) {
    throw new PgContextError(
      'MISSING_IDENTITY',
      'PUBLIC_FLOW salon context requires a non-empty resolved salonId.'
    );
  }
  return Object.freeze({
    role: 'PUBLIC_FLOW',
    salonId: cleanSalonId,
    agentId: null,
    userId: null,
  });
}

async function writePgLocalGucs(
  client: PoolClient,
  normalized: NormalizedPgActorContext
): Promise<void> {
  await client.query(
    `SELECT
       set_config('app.current_user_role', $1, true),
       set_config('app.current_salon_id', $2, true),
       set_config('app.current_agent_id', $3, true),
       set_config('app.current_user_id', $4, true)`,
    [normalized.role, normalized.salonId, normalized.agentId, normalized.userId]
  );
}

export async function applyPgActorContext(
  client: PoolClient,
  ctx: PgActorContext
): Promise<void> {
  const normalized = validatePgActorContext(ctx);
  const activeRole = ACTIVE_TX_ROLES.get(client);
  if (activeRole && activeRole !== normalized.role) {
    throw new PgContextError(
      'PRIVILEGE_ESCALATION',
      `Cannot switch PostgreSQL transaction role from ${activeRole} to ${normalized.role}.`
    );
  }
  await writePgLocalGucs(client, normalized);
}

/**
 * Narrows an active PUBLIC_FLOW transaction after resolving salons.id from public_code.
 * Rejects any attempt to invoke from a non-PUBLIC_FLOW transaction or with an empty salonId.
 */
export async function narrowPublicFlowSalonContext(
  client: PoolClient,
  salonId: string
): Promise<void> {
  const activeRole = ACTIVE_TX_ROLES.get(client);
  if (activeRole && activeRole !== 'PUBLIC_FLOW') {
    throw new PgContextError(
      'PRIVILEGE_ESCALATION',
      `narrowPublicFlowSalonContext cannot be called inside a ${activeRole} transaction.`
    );
  }
  const scoped = createPublicFlowSalonActor(salonId);
  const normalized = validatePgActorContext(scoped);
  await writePgLocalGucs(client, normalized);
}

export async function withPgTransaction<T>(
  ctx: PgActorContext,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  if (typeof fn !== 'function') {
    throw new PgContextError('INVALID_CONTEXT', 'withPgTransaction requires a transaction callback.');
  }
  const normalized = validatePgActorContext(ctx);
  const pool = getPgPool();
  if (!pool) {
    throw new Error('PostgreSQL pool unavailable: DATABASE_URL is not configured.');
  }

  const client = await pool.connect();
  let inTx = false;
  try {
    await client.query('BEGIN');
    inTx = true;
    ACTIVE_TX_ROLES.set(client, normalized.role);
    await writePgLocalGucs(client, normalized);
    const result = await fn(client);
    await client.query('COMMIT');
    inTx = false;
    return result;
  } catch (err) {
    if (inTx) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback errors
      }
      inTx = false;
    }
    throw err;
  } finally {
    ACTIVE_TX_ROLES.delete(client);
    client.release();
  }
}

export interface PostgresSalonLookupRow {
  id: string;
  publicCode: string;
  salonName: string;
  salonCategory: 'MENS' | 'LADIES';
  ownerAuthPhone: string;
  publicContactPhone: string;
  publicWhatsappPhone?: string;
  timezoneIana: string;
  timezoneOffsetHours: number;
  currencyCode: string;
  currencySymbol: string;
  defaultLang: 'en' | 'roman_ur' | 'ur' | 'ar';
  enabledLangs: Array<'en' | 'roman_ur' | 'ur' | 'ar'>;
  planTier: string;
  monthlyLimit: number;
  billingStatus: string;
  whatsappAddonEnabled: boolean;
  address: string;
  googleMapsUrl: string;
  googleReviewUrl: string;
}

export async function persistPostgresSnapshotMirror(
  params: {
    salonId: string;
    publicCode: string;
    salonName: string;
    ownerName?: string;
    salonCategory?: string;
    ownerAuthPhone: string;
    publicContactPhone: string;
    publicWhatsappPhone?: string;
    timezoneIana: string;
    timezoneOffsetHours?: number;
    currencyCode: string;
    currencySymbol: string;
    defaultLang?: string;
    enabledLangs?: string[];
    planTier: string;
    monthlyLimit: number;
    billingStatus: string;
    address?: string;
    googleMapsUrl?: string;
    googleReviewUrl?: string;
  },
  actor: PgActorContext
): Promise<void> {
  const normalizedActor = validatePgActorContext(actor);
  if (normalizedActor.role === 'PUBLIC_FLOW') {
    throw new PgContextError(
      'PRIVILEGE_ESCALATION',
      'PUBLIC_FLOW cannot mutate salon settings.'
    );
  }
  if (normalizedActor.role === 'SALON_OWNER' && normalizedActor.salonId !== params.salonId) {
    throw new PgContextError(
      'FORBIDDEN_TENANT',
      `SALON_OWNER (${normalizedActor.salonId}) cannot modify salon ${params.salonId}.`
    );
  }

  const pool = getPgPool();
  if (!pool) return;

  const packageTier =
    params.planTier === 'STARTER' ||
    params.planTier === 'PRO' ||
    params.planTier === 'PRO++' ||
    params.planTier === 'GROWTH' ||
    params.planTier === 'VIP' ||
    params.planTier === 'CUSTOM'
      ? params.planTier
      : 'PRO++';
  const billingStatus =
    normalizedActor.role === 'FOUNDER'
      ? params.billingStatus === 'ACTIVE' ||
        params.billingStatus === 'PAST_DUE' ||
        params.billingStatus === 'SUSPENDED'
        ? params.billingStatus
        : 'PENDING_ACTIVATION'
      : 'PENDING_ACTIVATION';

  const enabledLangs =
    Array.isArray(params.enabledLangs) && params.enabledLangs.length > 0
      ? params.enabledLangs
      : ['en', 'roman_ur', 'ur'];

  try {
    await withPgTransaction(actor, async (client) => {
      if (normalizedActor.role === 'FOUNDER') {
        await client.query(
          `INSERT INTO salons (
             id, public_code, salon_name, owner_name, whatsapp_phone,
             salon_category, owner_auth_phone, public_contact_phone, public_whatsapp_phone,
             timezone_iana, timezone_offset_hours, currency, currency_code, currency_symbol,
             default_lang, enabled_langs, package_tier, plan_tier, monthly_booking_limit,
             billing_status, whatsapp_addon_enabled, address, google_maps_url, google_review_url
           )
           VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, $8, $9,
             $10, $11, $12, $12, $13,
             $14, $15::text[], $16, $16, $17,
             $18, FALSE, $19, $20, $21
           )
           ON CONFLICT (id) DO UPDATE SET
             public_code = COALESCE(salons.public_code, EXCLUDED.public_code),
             salon_name = EXCLUDED.salon_name,
             salon_category = EXCLUDED.salon_category,
             public_contact_phone = EXCLUDED.public_contact_phone,
             public_whatsapp_phone = EXCLUDED.public_whatsapp_phone,
             timezone_iana = EXCLUDED.timezone_iana,
             timezone_offset_hours = EXCLUDED.timezone_offset_hours,
             currency = EXCLUDED.currency,
             currency_code = EXCLUDED.currency_code,
             currency_symbol = EXCLUDED.currency_symbol,
             default_lang = EXCLUDED.default_lang,
             enabled_langs = EXCLUDED.enabled_langs,
             package_tier = EXCLUDED.package_tier,
             plan_tier = EXCLUDED.plan_tier,
             monthly_booking_limit = EXCLUDED.monthly_booking_limit,
             billing_status = EXCLUDED.billing_status,
             address = EXCLUDED.address,
             google_maps_url = EXCLUDED.google_maps_url,
             google_review_url = EXCLUDED.google_review_url,
             updated_at = NOW()`,
          [
            params.salonId,
            params.publicCode,
            params.salonName,
            params.ownerName || 'Salon Owner',
            params.publicContactPhone || params.ownerAuthPhone,
            params.salonCategory === 'LADIES' ? 'LADIES' : 'MENS',
            params.ownerAuthPhone,
            params.publicContactPhone,
            params.publicWhatsappPhone || null,
            params.timezoneIana,
            Number.isFinite(params.timezoneOffsetHours) ? params.timezoneOffsetHours : 5,
            params.currencyCode,
            params.currencySymbol,
            params.defaultLang || 'en',
            enabledLangs,
            packageTier,
            params.monthlyLimit,
            billingStatus,
            params.address || '',
            params.googleMapsUrl || '',
            params.googleReviewUrl || '',
          ]
        );
        return;
      }

      if (normalizedActor.role === 'AGENT') {
        await client.query(
          `INSERT INTO salons (
             id, public_code, salon_name, owner_name, whatsapp_phone,
             salon_category, owner_auth_phone, public_contact_phone, public_whatsapp_phone,
             timezone_iana, timezone_offset_hours, currency, currency_code, currency_symbol,
             default_lang, enabled_langs, package_tier, plan_tier, monthly_booking_limit,
             billing_status, whatsapp_addon_enabled, address, google_maps_url, google_review_url,
             assigned_agent_id
           )
           VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, $8, $9,
             $10, $11, $12, $12, $13,
             $14, $15::text[], $16, $16, $17,
             'PENDING_ACTIVATION', FALSE, $18, $19, $20,
             $21
           )
           ON CONFLICT (id) DO NOTHING`,
          [
            params.salonId,
            params.publicCode,
            params.salonName,
            params.ownerName || 'Salon Owner',
            params.publicContactPhone || params.ownerAuthPhone,
            params.salonCategory === 'LADIES' ? 'LADIES' : 'MENS',
            params.ownerAuthPhone,
            params.publicContactPhone,
            params.publicWhatsappPhone || null,
            params.timezoneIana,
            Number.isFinite(params.timezoneOffsetHours) ? params.timezoneOffsetHours : 5,
            params.currencyCode,
            params.currencySymbol,
            params.defaultLang || 'en',
            enabledLangs,
            packageTier,
            params.monthlyLimit,
            params.address || '',
            params.googleMapsUrl || '',
            params.googleReviewUrl || '',
            normalizedActor.agentId,
          ]
        );
        return;
      }

      // SALON_OWNER: Never overwrites billing_status, package_tier, plan_tier, or monthly_booking_limit on UPDATE.
      await client.query(
        `INSERT INTO salons (
           id, public_code, salon_name, owner_name, whatsapp_phone,
           salon_category, owner_auth_phone, public_contact_phone, public_whatsapp_phone,
           timezone_iana, timezone_offset_hours, currency, currency_code, currency_symbol,
           default_lang, enabled_langs, package_tier, plan_tier, monthly_booking_limit,
           billing_status, whatsapp_addon_enabled, address, google_maps_url, google_review_url
         )
         VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9,
           $10, $11, $12, $12, $13,
           $14, $15::text[], $16, $16, $17,
           'PENDING_ACTIVATION', FALSE, $18, $19, $20
         )
         ON CONFLICT (id) DO UPDATE SET
           public_code = COALESCE(salons.public_code, EXCLUDED.public_code),
           salon_name = EXCLUDED.salon_name,
           salon_category = EXCLUDED.salon_category,
           public_contact_phone = EXCLUDED.public_contact_phone,
           public_whatsapp_phone = EXCLUDED.public_whatsapp_phone,
           timezone_iana = EXCLUDED.timezone_iana,
           timezone_offset_hours = EXCLUDED.timezone_offset_hours,
           currency = EXCLUDED.currency,
           currency_code = EXCLUDED.currency_code,
           currency_symbol = EXCLUDED.currency_symbol,
           default_lang = EXCLUDED.default_lang,
           enabled_langs = EXCLUDED.enabled_langs,
           address = EXCLUDED.address,
           google_maps_url = EXCLUDED.google_maps_url,
           google_review_url = EXCLUDED.google_review_url,
           updated_at = NOW()`,
        [
          params.salonId,
          params.publicCode,
          params.salonName,
          params.ownerName || 'Salon Owner',
          params.publicContactPhone || params.ownerAuthPhone,
          params.salonCategory === 'LADIES' ? 'LADIES' : 'MENS',
          params.ownerAuthPhone,
          params.publicContactPhone,
          params.publicWhatsappPhone || null,
          params.timezoneIana,
          Number.isFinite(params.timezoneOffsetHours) ? params.timezoneOffsetHours : 5,
          params.currencyCode,
          params.currencySymbol,
          params.defaultLang || 'en',
          enabledLangs,
          packageTier,
          params.monthlyLimit,
          params.address || '',
          params.googleMapsUrl || '',
          params.googleReviewUrl || '',
        ]
      );
    });
  } catch (err) {
    if (err instanceof PgContextError) {
      throw err;
    }
    console.warn(
      'Postgres salon sync failed (verify migration 003_reconcile_authoritative_schema.sql is applied):',
      err
    );
    if (isProductionEnv()) {
      throw err;
    }
  }
}

export async function findSalonByPublicCodeInPostgres(
  publicCode: string
): Promise<PostgresSalonLookupRow | null> {
  const cleanCode = typeof publicCode === 'string' ? publicCode.trim() : '';
  if (!cleanCode || !cleanCode.startsWith('wc_')) return null;

  const pool = getPgPool();
  if (!pool) return null;
  try {
    return await withPgTransaction(createPublicFlowLookupActor(), async (client) => {
      const res = await client.query<{
        id: string;
        public_code: string;
        salon_name: string;
        salon_category: string | null;
        owner_auth_phone: string;
        public_contact_phone: string;
        public_whatsapp_phone: string | null;
        timezone_iana: string | null;
        timezone_offset_hours: string | number | null;
        currency_code: string | null;
        currency_symbol: string | null;
        default_lang: string | null;
        enabled_langs: string[] | null;
        plan_tier: string | null;
        monthly_booking_limit: number | null;
        billing_status: string | null;
        whatsapp_addon_enabled: boolean | null;
        address: string | null;
        google_maps_url: string | null;
        google_review_url: string | null;
      }>(
        `SELECT id, public_code, salon_name, salon_category, owner_auth_phone, public_contact_phone,
                public_whatsapp_phone, timezone_iana, timezone_offset_hours, currency_code, currency_symbol,
                default_lang, enabled_langs, plan_tier, monthly_booking_limit, billing_status,
                whatsapp_addon_enabled, address, google_maps_url, google_review_url
         FROM salons
         WHERE public_code = $1
         LIMIT 1`,
        [cleanCode]
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      const defaultLang =
        row.default_lang === 'roman_ur' || row.default_lang === 'ur' || row.default_lang === 'ar'
          ? row.default_lang
          : 'en';
      const enabledLangs = Array.isArray(row.enabled_langs)
        ? row.enabled_langs.filter(
            (l): l is 'en' | 'roman_ur' | 'ur' | 'ar' =>
              l === 'en' || l === 'roman_ur' || l === 'ur' || l === 'ar'
          )
        : (['en', 'roman_ur', 'ur'] as Array<'en' | 'roman_ur' | 'ur' | 'ar'>);
      return {
        id: row.id,
        publicCode: row.public_code,
        salonName: row.salon_name,
        salonCategory: row.salon_category === 'LADIES' ? 'LADIES' : 'MENS',
        ownerAuthPhone: row.owner_auth_phone,
        publicContactPhone: row.public_contact_phone,
        publicWhatsappPhone: row.public_whatsapp_phone || undefined,
        timezoneIana: row.timezone_iana || 'Asia/Karachi',
        timezoneOffsetHours: Number(row.timezone_offset_hours ?? 5),
        currencyCode: row.currency_code || 'PKR',
        currencySymbol: row.currency_symbol || 'PKR ',
        defaultLang,
        enabledLangs,
        planTier: row.plan_tier || 'PRO++',
        monthlyLimit: Number(row.monthly_booking_limit ?? 3000),
        billingStatus: row.billing_status || 'ACTIVE',
        whatsappAddonEnabled: Boolean(row.whatsapp_addon_enabled),
        address: row.address || '',
        googleMapsUrl: row.google_maps_url || '',
        googleReviewUrl: row.google_review_url || '',
      };
    });
  } catch (err) {
    if (err instanceof PgContextError) {
      throw err;
    }
    console.warn('Postgres public_code lookup failed:', err);
    if (isProductionEnv()) {
      throw err;
    }
    return null;
  }
}

export async function recordBookingInPostgres(params: {
  salonPublicCode: string;
  bookingRef: string;
  clientName: string;
  clientPhoneE164: string;
  preferredLang: string;
  stylistName: string;
  servicesSnapshot: unknown;
  totalPrice: number;
  totalDurationMins: number;
  startsAtIso: string;
  endsAtIso: string;
  source: string;
  idempotencyKey?: string;
  proofHash: string;
  billingMonth: string;
  monthlyLimit: number;
  accessTokenHash: string;
  accessTokenExpiresAtIso: string;
}): Promise<{ ok: true } | { ok: false; code: 'OVERLAP' | 'DB_UNAVAILABLE'; error: string }> {
  const cleanCode = typeof params.salonPublicCode === 'string' ? params.salonPublicCode.trim() : '';
  if (!cleanCode || !cleanCode.startsWith('wc_')) {
    return {
      ok: false,
      code: 'DB_UNAVAILABLE',
      error: 'Valid salon public booking code is required.',
    };
  }

  const pool = getPgPool();
  if (!pool) {
    if (isProductionEnv()) {
      return {
        ok: false,
        code: 'DB_UNAVAILABLE',
        error: 'Database is not configured. Booking cannot be confirmed without persistent storage.',
      };
    }
    return { ok: true };
  }

  try {
    return await withPgTransaction(createPublicFlowLookupActor(), async (client) => {
      const salonRes = await client.query<{ id: string }>(
        'SELECT id FROM salons WHERE public_code = $1 LIMIT 1',
        [cleanCode]
      );
      if (salonRes.rows.length === 0) {
        return {
          ok: false as const,
          code: 'DB_UNAVAILABLE' as const,
          error: 'Salon booking record could not be verified in database.',
        };
      }
      const salonId = salonRes.rows[0].id;

      // Narrow transaction RLS context to the resolved salon_id (salons.id TEXT)
      await narrowPublicFlowSalonContext(client, salonId);

      const generatedClientId = `cli-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const cliRes = await client.query<{ id: string }>(
        `INSERT INTO clients (
           id, salon_id, name, phone, phone_e164, preferred_language, preferred_lang, awaiting_language_selection
         )
         VALUES ($1, $2, $3, $4, $4, $5, $5, FALSE)
         ON CONFLICT (salon_id, phone_e164) DO UPDATE SET
           name = EXCLUDED.name,
           preferred_language = EXCLUDED.preferred_language,
           preferred_lang = EXCLUDED.preferred_lang,
           updated_at = NOW()
         RETURNING id`,
        [
          generatedClientId,
          salonId,
          params.clientName,
          params.clientPhoneE164,
          params.preferredLang,
        ]
      );
      const clientId = cliRes.rows[0].id;

      const styRes = await client.query<{ id: string }>(
        `INSERT INTO stylists (salon_id, name)
         VALUES ($1, $2)
         ON CONFLICT (salon_id, name) DO UPDATE SET active = TRUE
         RETURNING id`,
        [salonId, params.stylistName]
      );
      const stylistUuid = styRes.rows[0].id;

      if (params.idempotencyKey) {
        const dup = await client.query(
          `SELECT id FROM bookings WHERE salon_id = $1 AND idempotency_key = $2 LIMIT 1`,
          [salonId, params.idempotencyKey]
        );
        if (dup.rows.length > 0) return { ok: true as const };
      }

      const bkRes = await client.query<{ id: string }>(
        `INSERT INTO bookings (
           salon_id, client_id, stylist_id, booking_ref, services_snapshot,
           total_price, total_duration_mins, starts_at, ends_at,
           status, source, idempotency_key, proof_hash
         )
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::timestamptz, $9::timestamptz, 'CONFIRMED', $10, $11, $12)
         RETURNING id`,
        [
          salonId,
          clientId,
          stylistUuid,
          params.bookingRef,
          JSON.stringify(params.servicesSnapshot),
          params.totalPrice,
          params.totalDurationMins,
          params.startsAtIso,
          params.endsAtIso,
          params.source,
          params.idempotencyKey || null,
          params.proofHash,
        ]
      );
      const bookingUuid = bkRes.rows[0].id;

      await client.query(
        `INSERT INTO booking_access_tokens (token_hash, booking_id, salon_id, expires_at)
         VALUES ($1, $2, $3, $4::timestamptz)`,
        [params.accessTokenHash, bookingUuid, salonId, params.accessTokenExpiresAtIso]
      );

      await client.query(
        `INSERT INTO salon_usage_monthly (salon_id, billing_month, billable_bookings, limit_snapshot)
         VALUES ($1, $2, 1, $3)
         ON CONFLICT (salon_id, billing_month) DO UPDATE SET
           billable_bookings = salon_usage_monthly.billable_bookings + 1,
           limit_snapshot = EXCLUDED.limit_snapshot,
           updated_at = NOW()`,
        [salonId, params.billingMonth, params.monthlyLimit]
      );

      await client.query(
        `INSERT INTO booking_audit_log (salon_id, booking_id, actor_type, action, new_state)
         VALUES ($1, $2, 'CUSTOMER', 'CREATED', $3::jsonb)`,
        [
          salonId,
          bookingUuid,
          JSON.stringify({ startsAt: params.startsAtIso, stylist: params.stylistName }),
        ]
      );

      return { ok: true as const };
    });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr?.code === '23P01') {
      return {
        ok: false,
        code: 'OVERLAP',
        error: 'That stylist was just booked for this time slot. Please choose another open slot.',
      };
    }
    console.error('Postgres booking commit failed (fail-closed):', err);
    return {
      ok: false,
      code: 'DB_UNAVAILABLE',
      error: 'Could not commit booking cleanly to database. Please retry.',
    };
  }
}
