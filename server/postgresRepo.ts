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

import crypto from 'crypto';
import { Pool, type PoolClient } from 'pg';
import type { AuthUser } from '../src/types/auth.js';
import { PgContextError, type PgContextErrorCode } from './pgContextError.js';

export { PgContextError, type PgContextErrorCode };

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

async function setPublicFlowScopedGucs(
  client: PoolClient,
  scope: {
    publicCode?: string | null;
    tokenHash?: string | null;
    bookingId?: string | null;
    clientId?: string | null;
    idempotencyKey?: string | null;
  }
): Promise<void> {
  const activeRole = ACTIVE_TX_ROLES.get(client);
  if (activeRole && activeRole !== 'PUBLIC_FLOW') {
    throw new PgContextError(
      'PRIVILEGE_ESCALATION',
      `setPublicFlowScopedGucs cannot be called inside a ${activeRole} transaction.`
    );
  }
  const clauses: string[] = [];
  const params: string[] = [];
  if (scope.publicCode !== undefined) {
    params.push(cleanActorId(scope.publicCode, 'publicCode'));
    clauses.push(`set_config('app.current_public_code', $${params.length}, true)`);
  }
  if (scope.tokenHash !== undefined) {
    params.push(cleanActorId(scope.tokenHash, 'tokenHash'));
    clauses.push(`set_config('app.current_token_hash', $${params.length}, true)`);
  }
  if (scope.bookingId !== undefined) {
    params.push(cleanActorId(scope.bookingId, 'bookingId'));
    clauses.push(`set_config('app.current_booking_id', $${params.length}, true)`);
  }
  if (scope.clientId !== undefined) {
    params.push(cleanActorId(scope.clientId, 'clientId'));
    clauses.push(`set_config('app.current_client_id', $${params.length}, true)`);
  }
  if (scope.idempotencyKey !== undefined) {
    params.push(cleanActorId(scope.idempotencyKey, 'idempotencyKey'));
    clauses.push(`set_config('app.current_idempotency_key', $${params.length}, true)`);
  }
  if (clauses.length === 0) return;
  await client.query(`SELECT ${clauses.join(', ')}`, params);
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
            'STARTER',
            750,
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
          'STARTER',
          750,
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

export async function syncSalonStylistsInPostgres(
  salonId: string,
  barbers: string[],
  actor: PgActorContext
): Promise<void> {
  assertOwnerOrFounderActor(actor, salonId, 'syncSalonStylistsInPostgres');

  const pool = getPgPool();
  if (!pool) return;

  const cleaned = barbers
    .map((b) => (typeof b === 'string' ? b.trim() : ''))
    .filter(Boolean)
    .slice(0, 30);
  if (cleaned.length === 0) return;

  await withPgTransaction(actor, async (client) => {
    for (const name of cleaned) {
      await client.query(
        `INSERT INTO stylists (salon_id, name, active)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (salon_id, name) DO UPDATE SET active = TRUE`,
        [salonId, name]
      );
    }
  });
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
      await setPublicFlowScopedGucs(client, { publicCode: cleanCode });
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
      await setPublicFlowScopedGucs(client, { publicCode: cleanCode });
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

      const bookingUuid = crypto.randomUUID();
      await setPublicFlowScopedGucs(client, {
        tokenHash: params.accessTokenHash,
        bookingId: bookingUuid,
        idempotencyKey: params.idempotencyKey || '',
      });

      if (params.idempotencyKey) {
        const dup = await client.query(
          `SELECT id FROM bookings WHERE salon_id = $1 AND idempotency_key = $2 LIMIT 1`,
          [salonId, params.idempotencyKey]
        );
        if (dup.rows.length > 0) return { ok: true as const };
      }

      const generatedClientId = `cli-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const cliRes = await client.query<{ id: string }>(
        `SELECT upsert_public_booking_client($1, $2, $3, $4, $5) AS id`,
        [
          salonId,
          generatedClientId,
          params.clientName,
          params.clientPhoneE164,
          params.preferredLang,
        ]
      );
      const clientId = cliRes.rows[0].id;

      const styRes = await client.query<{ id: string }>(
        `SELECT id
         FROM stylists
         WHERE salon_id = $1
           AND LOWER(BTRIM(name)) = LOWER(BTRIM($2))
           AND active = TRUE
         LIMIT 1`,
        [salonId, params.stylistName]
      );
      if (styRes.rows.length === 0) {
        return {
          ok: false as const,
          code: 'OVERLAP' as const,
          error: 'Selected stylist is not available for booking at this salon.',
        };
      }
      const stylistUuid = styRes.rows[0].id;

      const bkRes = await client.query<{ id: string }>(
        `INSERT INTO bookings (
           id, salon_id, client_id, stylist_id, booking_ref, services_snapshot,
           total_price, total_duration_mins, starts_at, ends_at,
           status, source, idempotency_key, proof_hash
         )
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::timestamptz, $10::timestamptz, 'CONFIRMED', $11, $12, $13)
         RETURNING id`,
        [
          bookingUuid,
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
      const committedBookingUuid = bkRes.rows[0].id;

      await client.query(
        `INSERT INTO booking_access_tokens (token_hash, booking_id, salon_id, expires_at)
         VALUES ($1, $2, $3, $4::timestamptz)`,
        [params.accessTokenHash, committedBookingUuid, salonId, params.accessTokenExpiresAtIso]
      );

      await client.query(
        `SELECT increment_salon_monthly_booking_usage($1, $2, $3) AS billable_bookings`,
        [salonId, committedBookingUuid, params.billingMonth]
      );

      await client.query(
        `INSERT INTO booking_audit_log (salon_id, booking_id, actor_type, action, new_state)
         VALUES ($1, $2, 'CUSTOMER', 'CREATED', $3::jsonb)`,
        [
          salonId,
          committedBookingUuid,
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
    if (pgErr?.code === 'P0002') {
      return {
        ok: false,
        code: 'DB_UNAVAILABLE',
        error: 'This salon has reached its monthly online booking capacity. Please contact the salon directly.',
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

// =============================================================================
// Phase 0C — PostgreSQL-Authoritative Booking Lifecycle & Availability
// =============================================================================

export type PgBookingStatus = 'CONFIRMED' | 'IN_CHAIR' | 'COMPLETED' | 'CANCELED' | 'NO_SHOW';

export interface PgBookingRecord {
  id: string;
  salonId: string;
  salonPublicCode: string;
  salonName: string;
  publicContactPhone: string;
  publicWhatsappPhone?: string;
  whatsappPhone: string;
  timezoneOffsetHours: number;
  currencySymbol: string;
  defaultLang: string;
  address: string;
  googleMapsUrl: string;
  googleReviewUrl: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  preferredLanguage: string | null;
  stylistId: string;
  stylistName: string;
  bookingRef: string;
  servicesSnapshot: Array<{ id?: string; name: string; price?: number; durationMins?: number }>;
  totalPrice: number;
  totalDurationMins: number;
  startsAtIso: string;
  endsAtIso: string;
  status: PgBookingStatus;
  source: string;
  dealId: string | null;
  idempotencyKey?: string;
  proofHash: string;
  completedAtIso: string | null;
  createdAtIso: string;
}

export interface PgAvailabilitySnapshot {
  salonId: string;
  publicCode: string;
  timezoneOffsetHours: number;
  operatingHours: Record<string, unknown> | null;
  stylists: Array<{ id: string; name: string; chairLabel: string; active: boolean }>;
  services: Array<{
    id: string;
    name: string;
    price: number;
    durationMins: number;
    bufferAfterMins: number;
    active: boolean;
    eligibleStylists: string[];
  }>;
  bookings: Array<{
    id: string;
    bookingRef: string;
    stylistId: string;
    stylistName: string;
    startsAtIso: string;
    endsAtIso: string;
    status: PgBookingStatus;
    totalDurationMins: number;
  }>;
  leaves: Array<{
    id: string;
    stylistId: string;
    stylistName: string;
    lockType: string;
    startsAtIso: string;
    endsAtIso: string;
    reason: string;
  }>;
}

export interface PgClientVisitRecord {
  id: string;
  salonId: string;
  name: string;
  phone: string;
  preferredLanguage: string | null;
  birthDate: string;
  lastCompletedVisitAt: string | null;
  totalVisits: number;
}

export interface PgBookingAuditRow {
  id: string;
  salonId: string;
  bookingId: string;
  actorType: 'CUSTOMER' | 'OWNER' | 'SYSTEM';
  action: 'CREATED' | 'RESCHEDULED' | 'CANCELED' | 'IN_CHAIR' | 'COMPLETED';
  note: string;
  createdAt: string;
}

export type SlotResolverFn = (
  snapshot: PgAvailabilitySnapshot,
  currentBooking: PgBookingRecord
) =>
  | {
      ok: true;
      startUtcIso: string;
      endUtcIso: string;
      formattedTime: string;
      barberName: string;
      durationMins: number;
    }
  | { ok: false; statusCode: number; error: string };

export function parseBookingAccessTokenPublicCode(rawToken: string): string | null {
  const clean = typeof rawToken === 'string' ? rawToken.trim() : '';
  if (!clean.startsWith('wcbt_')) return null;
  const dotIdx = clean.indexOf('.');
  if (dotIdx <= 5) return null;
  const encodedCode = clean.slice(5, dotIdx);
  const secretPart = clean.slice(dotIdx + 1);
  if (secretPart.length < 16) return null;
  try {
    const decoded = Buffer.from(encodedCode, 'base64url').toString('utf8').trim();
    if (!/^wc_[a-zA-Z0-9_-]{4,64}$/.test(decoded)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function hashAccessToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

function assertOwnerOrFounderActor(
  actor: PgActorContext,
  salonId: string,
  operation: string
): NormalizedPgActorContext {
  const normalized = validatePgActorContext(actor);
  if (normalized.role !== 'FOUNDER' && normalized.role !== 'SALON_OWNER') {
    throw new PgContextError(
      'PRIVILEGE_ESCALATION',
      `${normalized.role} is not authorized to perform ${operation}.`
    );
  }
  if (normalized.role === 'SALON_OWNER' && normalized.salonId !== salonId) {
    throw new PgContextError(
      'FORBIDDEN_TENANT',
      `SALON_OWNER (${normalized.salonId}) cannot access salon ${salonId} during ${operation}.`
    );
  }
  return normalized;
}

function assertAvailabilityActor(
  actor: PgActorContext,
  salonId: string
): NormalizedPgActorContext {
  const normalized = validatePgActorContext(actor);
  if (normalized.role === 'AGENT') {
    throw new PgContextError(
      'PRIVILEGE_ESCALATION',
      'AGENT cannot query public booking availability directly.'
    );
  }
  if (
    (normalized.role === 'SALON_OWNER' || normalized.role === 'PUBLIC_FLOW') &&
    normalized.salonId !== salonId
  ) {
    throw new PgContextError(
      'FORBIDDEN_TENANT',
      `${normalized.role} (${normalized.salonId}) cannot read availability for salon ${salonId}.`
    );
  }
  return normalized;
}

interface RawJoinedBookingRow {
  id: string;
  salon_id: string;
  salon_public_code: string | null;
  salon_name: string;
  public_contact_phone: string | null;
  public_whatsapp_phone: string | null;
  whatsapp_phone: string;
  timezone_offset_hours: string | number | null;
  currency_symbol: string | null;
  default_lang: string | null;
  address: string | null;
  google_maps_url: string | null;
  google_review_url: string | null;
  client_id: string;
  client_name: string;
  client_phone: string;
  preferred_language: string | null;
  stylist_id: string;
  stylist_name: string;
  booking_ref: string;
  services_snapshot: unknown;
  total_price: number;
  total_duration_mins: number;
  starts_at: string | Date;
  ends_at: string | Date;
  status: PgBookingStatus;
  source: string;
  deal_id: string | null;
  idempotency_key: string | null;
  proof_hash: string;
  completed_at: string | Date | null;
  created_at: string | Date;
}

function toIsoString(val: string | Date | null | undefined): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  const parsed = new Date(val);
  return Number.isNaN(parsed.getTime()) ? String(val) : parsed.toISOString();
}

function mapRawBookingRow(row: RawJoinedBookingRow): PgBookingRecord {
  const snapshot = Array.isArray(row.services_snapshot)
    ? (row.services_snapshot as Array<{
        id?: string;
        name: string;
        price?: number;
        durationMins?: number;
      }>)
    : [];
  return {
    id: row.id,
    salonId: row.salon_id,
    salonPublicCode: row.salon_public_code || '',
    salonName: row.salon_name,
    publicContactPhone: row.public_contact_phone || row.whatsapp_phone || '',
    publicWhatsappPhone: row.public_whatsapp_phone || undefined,
    whatsappPhone: row.whatsapp_phone || '',
    timezoneOffsetHours: Number(row.timezone_offset_hours ?? 5),
    currencySymbol: row.currency_symbol || 'PKR ',
    defaultLang: row.default_lang || 'en',
    address: row.address || '',
    googleMapsUrl: row.google_maps_url || '',
    googleReviewUrl: row.google_review_url || '',
    clientId: row.client_id,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    preferredLanguage: row.preferred_language,
    stylistId: row.stylist_id,
    stylistName: row.stylist_name,
    bookingRef: row.booking_ref,
    servicesSnapshot: snapshot,
    totalPrice: Number(row.total_price ?? 0),
    totalDurationMins: Number(row.total_duration_mins ?? 35),
    startsAtIso: toIsoString(row.starts_at),
    endsAtIso: toIsoString(row.ends_at),
    status: row.status,
    source: row.source,
    dealId: row.deal_id,
    idempotencyKey: row.idempotency_key || undefined,
    proofHash: row.proof_hash,
    completedAtIso: row.completed_at ? toIsoString(row.completed_at) : null,
    createdAtIso: toIsoString(row.created_at),
  };
}

const JOINED_BOOKING_SELECT = `
  SELECT b.id, b.salon_id, s.public_code AS salon_public_code, s.salon_name,
         s.public_contact_phone, s.public_whatsapp_phone, s.whatsapp_phone,
         s.timezone_offset_hours, s.currency_symbol, s.default_lang,
         s.address, s.google_maps_url, s.google_review_url,
         b.client_id, c.name AS client_name, COALESCE(NULLIF(c.phone_e164, ''), c.phone) AS client_phone,
         COALESCE(NULLIF(c.preferred_lang, ''), c.preferred_language) AS preferred_language,
         b.stylist_id, st.name AS stylist_name, b.booking_ref,
         b.services_snapshot, b.total_price, b.total_duration_mins,
         b.starts_at, b.ends_at, b.status, b.source, b.deal_id,
         b.idempotency_key, b.proof_hash, b.completed_at, b.created_at
  FROM bookings b
  JOIN salons s ON s.id = b.salon_id
  JOIN clients c ON c.id = b.client_id
  JOIN stylists st ON st.id = b.stylist_id
`;

async function queryAvailabilitySnapshotWithClient(
  client: PoolClient,
  params: {
    salonId: string;
    windowStartIso: string;
    windowEndIso: string;
    excludeBookingId?: string;
  }
): Promise<PgAvailabilitySnapshot | null> {
  const salonRes = await client.query<{
    id: string;
    public_code: string | null;
    timezone_offset_hours: string | number | null;
    operating_hours: Record<string, unknown> | null;
  }>(
    `SELECT id, public_code, timezone_offset_hours, operating_hours
     FROM salons
     WHERE id = $1
     LIMIT 1`,
    [params.salonId]
  );
  if (salonRes.rows.length === 0) return null;
  const salonRow = salonRes.rows[0];

  const stylistsRes = await client.query<{
    id: string;
    name: string;
    chair_label: string;
    active: boolean;
  }>(
    `SELECT id, name, chair_label, active
     FROM stylists
     WHERE salon_id = $1
     ORDER BY created_at ASC`,
    [params.salonId]
  );

  const servicesRes = await client.query<{
    id: string;
    name: string;
    price: number;
    duration_mins: number;
    buffer_after_mins: number;
    active: boolean;
    eligible_stylists: string[] | null;
  }>(
    `SELECT sv.id, sv.name, sv.price, sv.duration_mins, sv.buffer_after_mins, sv.active,
            COALESCE(
              array_agg(st.name) FILTER (WHERE st.name IS NOT NULL),
              ARRAY[]::text[]
            ) AS eligible_stylists
     FROM services sv
     LEFT JOIN service_stylists ss ON ss.service_id = sv.id
     LEFT JOIN stylists st ON st.id = ss.stylist_id AND st.active = TRUE
     WHERE sv.salon_id = $1
     GROUP BY sv.id, sv.name, sv.price, sv.duration_mins, sv.buffer_after_mins, sv.active`,
    [params.salonId]
  );

  const isPublicFlow = ACTIVE_TX_ROLES.get(client) === 'PUBLIC_FLOW';
  let availabilityBookings: PgAvailabilitySnapshot['bookings'];
  if (isPublicFlow) {
    const busyRes = await client.query<{
      stylist_id: string;
      stylist_name: string;
      starts_at: string | Date;
      ends_at: string | Date;
      status: PgBookingStatus;
      total_duration_mins: number;
    }>(
      `SELECT stylist_id, stylist_name, starts_at, ends_at, status, total_duration_mins
       FROM get_public_stylist_busy_blocks($1, $2::timestamptz, $3::timestamptz, $4)`,
      [
        params.salonId,
        params.windowStartIso,
        params.windowEndIso,
        params.excludeBookingId || null,
      ]
    );
    availabilityBookings = busyRes.rows.map((r) => ({
      id: '',
      bookingRef: '',
      stylistId: r.stylist_id,
      stylistName: r.stylist_name,
      startsAtIso: toIsoString(r.starts_at),
      endsAtIso: toIsoString(r.ends_at),
      status: r.status,
      totalDurationMins: Number(r.total_duration_mins ?? 35),
    }));
  } else {
    const bookingsRes = await client.query<{
      id: string;
      booking_ref: string;
      stylist_id: string;
      stylist_name: string;
      starts_at: string | Date;
      ends_at: string | Date;
      status: PgBookingStatus;
      total_duration_mins: number;
    }>(
      `SELECT b.id, b.booking_ref, b.stylist_id, st.name AS stylist_name,
              b.starts_at, b.ends_at, b.status, b.total_duration_mins
       FROM bookings b
       JOIN stylists st ON st.id = b.stylist_id
       WHERE b.salon_id = $1
         AND b.status IN ('CONFIRMED', 'IN_CHAIR')
         AND b.ends_at > $2::timestamptz
         AND b.starts_at < $3::timestamptz
         AND ($4::text IS NULL OR (b.id::text <> $4 AND b.booking_ref <> $4))
       ORDER BY b.starts_at ASC`,
      [
        params.salonId,
        params.windowStartIso,
        params.windowEndIso,
        params.excludeBookingId || null,
      ]
    );
    availabilityBookings = bookingsRes.rows.map((r) => ({
      id: r.id,
      bookingRef: r.booking_ref,
      stylistId: r.stylist_id,
      stylistName: r.stylist_name,
      startsAtIso: toIsoString(r.starts_at),
      endsAtIso: toIsoString(r.ends_at),
      status: r.status,
      totalDurationMins: Number(r.total_duration_mins ?? 35),
    }));
  }

  const leavesRes = await client.query<{
    id: string;
    stylist_id: string;
    stylist_name: string;
    lock_type: string;
    starts_at: string | Date;
    ends_at: string | Date;
    reason: string;
  }>(
    `SELECT sl.id, sl.stylist_id, st.name AS stylist_name,
            sl.lock_type, sl.starts_at, sl.ends_at, sl.reason
     FROM stylist_leaves sl
     JOIN stylists st ON st.id = sl.stylist_id
     WHERE sl.salon_id = $1
       AND sl.ends_at > $2::timestamptz
       AND sl.starts_at < $3::timestamptz`,
    [params.salonId, params.windowStartIso, params.windowEndIso]
  );

  return {
    salonId: salonRow.id,
    publicCode: salonRow.public_code || '',
    timezoneOffsetHours: Number(salonRow.timezone_offset_hours ?? 5),
    operatingHours:
      salonRow.operating_hours &&
      typeof salonRow.operating_hours === 'object' &&
      Object.keys(salonRow.operating_hours).length > 0
        ? salonRow.operating_hours
        : null,
    stylists: stylistsRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      chairLabel: r.chair_label,
      active: Boolean(r.active),
    })),
    services: servicesRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      price: Number(r.price ?? 0),
      durationMins: Number(r.duration_mins ?? 35),
      bufferAfterMins: Number(r.buffer_after_mins ?? 0),
      active: Boolean(r.active),
      eligibleStylists: Array.isArray(r.eligible_stylists) ? r.eligible_stylists : [],
    })),
    bookings: availabilityBookings,
    leaves: leavesRes.rows.map((r) => ({
      id: r.id,
      stylistId: r.stylist_id,
      stylistName: r.stylist_name,
      lockType: r.lock_type,
      startsAtIso: toIsoString(r.starts_at),
      endsAtIso: toIsoString(r.ends_at),
      reason: r.reason || '',
    })),
  };
}

export async function fetchAvailabilitySnapshotFromPostgres(
  params: {
    salonId: string;
    windowStartIso: string;
    windowEndIso: string;
    excludeBookingId?: string;
  },
  actor: PgActorContext
): Promise<PgAvailabilitySnapshot | null> {
  assertAvailabilityActor(actor, params.salonId);
  const pool = getPgPool();
  if (!pool) {
    if (isProductionEnv()) {
      throw new Error('PostgreSQL pool unavailable for availability query.');
    }
    return null;
  }

  return await withPgTransaction(actor, async (client) => {
    return await queryAvailabilitySnapshotWithClient(client, params);
  });
}

export async function getBookingByAccessTokenFromPostgres(
  rawToken: string
): Promise<PgBookingRecord | null> {
  const publicCode = parseBookingAccessTokenPublicCode(rawToken);
  if (!publicCode) return null;

  const pool = getPgPool();
  if (!pool) {
    if (isProductionEnv()) {
      throw new Error('PostgreSQL pool unavailable for booking lookup.');
    }
    return null;
  }

  const tokenHash = hashAccessToken(rawToken);
  return await withPgTransaction(createPublicFlowLookupActor(), async (client) => {
    await setPublicFlowScopedGucs(client, { publicCode });
    const salonRes = await client.query<{ id: string }>(
      'SELECT id FROM salons WHERE public_code = $1 LIMIT 1',
      [publicCode]
    );
    if (salonRes.rows.length === 0) return null;
    const salonId = salonRes.rows[0].id;

    await narrowPublicFlowSalonContext(client, salonId);
    await setPublicFlowScopedGucs(client, { tokenHash });

    const res = await client.query<
      RawJoinedBookingRow & { revoked_at: string | Date | null; expires_at: string | Date }
    >(
      `SELECT bat.revoked_at, bat.expires_at,
              b.id, b.salon_id, s.public_code AS salon_public_code, s.salon_name,
              s.public_contact_phone, s.public_whatsapp_phone, s.whatsapp_phone,
              s.timezone_offset_hours, s.currency_symbol, s.default_lang,
              s.address, s.google_maps_url, s.google_review_url,
              b.client_id, c.name AS client_name, COALESCE(NULLIF(c.phone_e164, ''), c.phone) AS client_phone,
              COALESCE(NULLIF(c.preferred_lang, ''), c.preferred_language) AS preferred_language,
              b.stylist_id, st.name AS stylist_name, b.booking_ref,
              b.services_snapshot, b.total_price, b.total_duration_mins,
              b.starts_at, b.ends_at, b.status, b.source, b.deal_id,
              b.idempotency_key, b.proof_hash, b.completed_at, b.created_at
       FROM booking_access_tokens bat
       JOIN bookings b ON b.id = bat.booking_id AND b.salon_id = bat.salon_id
       JOIN salons s ON s.id = b.salon_id
       JOIN clients c ON c.id = b.client_id
       JOIN stylists st ON st.id = b.stylist_id
       WHERE bat.token_hash = $1 AND bat.salon_id = $2
       LIMIT 1`,
      [tokenHash, salonId]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    if (row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) {
      return null;
    }
    return mapRawBookingRow(row);
  });
}

export async function rescheduleBookingByAccessTokenInPostgres(params: {
  rawToken: string;
  appointmentDate: string;
  windowStartIso: string;
  windowEndIso: string;
  resolveSlot: SlotResolverFn;
}): Promise<
  | { ok: true; booking: PgBookingRecord; oldSummary: string; newSummary: string }
  | { ok: false; statusCode: number; error: string }
> {
  const publicCode = parseBookingAccessTokenPublicCode(params.rawToken);
  if (!publicCode) {
    return {
      ok: false,
      statusCode: 404,
      error: 'This booking management link has expired or been revoked.',
    };
  }

  const pool = getPgPool();
  if (!pool) {
    return {
      ok: false,
      statusCode: 503,
      error: 'Database is not configured. Booking cannot be rescheduled without persistent storage.',
    };
  }

  const tokenHash = hashAccessToken(params.rawToken);
  try {
    return await withPgTransaction(createPublicFlowLookupActor(), async (client) => {
      await setPublicFlowScopedGucs(client, { publicCode });
      const salonRes = await client.query<{ id: string }>(
        'SELECT id FROM salons WHERE public_code = $1 LIMIT 1',
        [publicCode]
      );
      if (salonRes.rows.length === 0) {
        return {
          ok: false as const,
          statusCode: 404,
          error: 'This booking management link has expired or been revoked.',
        };
      }
      const salonId = salonRes.rows[0].id;

      await narrowPublicFlowSalonContext(client, salonId);
      await setPublicFlowScopedGucs(client, { tokenHash });

      const lockRes = await client.query<
        RawJoinedBookingRow & {
          token_id: string;
          revoked_at: string | Date | null;
          expires_at: string | Date;
        }
      >(
        `SELECT bat.id AS token_id, bat.revoked_at, bat.expires_at,
                b.id, b.salon_id, s.public_code AS salon_public_code, s.salon_name,
                s.public_contact_phone, s.public_whatsapp_phone, s.whatsapp_phone,
                s.timezone_offset_hours, s.currency_symbol, s.default_lang,
                s.address, s.google_maps_url, s.google_review_url,
                b.client_id, c.name AS client_name, COALESCE(NULLIF(c.phone_e164, ''), c.phone) AS client_phone,
                COALESCE(NULLIF(c.preferred_lang, ''), c.preferred_language) AS preferred_language,
                b.stylist_id, st.name AS stylist_name, b.booking_ref,
                b.services_snapshot, b.total_price, b.total_duration_mins,
                b.starts_at, b.ends_at, b.status, b.source, b.deal_id,
                b.idempotency_key, b.proof_hash, b.completed_at, b.created_at
         FROM booking_access_tokens bat
         JOIN bookings b ON b.id = bat.booking_id AND b.salon_id = bat.salon_id
         JOIN salons s ON s.id = b.salon_id
         JOIN clients c ON c.id = b.client_id
         JOIN stylists st ON st.id = b.stylist_id
         WHERE bat.token_hash = $1 AND bat.salon_id = $2
         FOR UPDATE OF b, bat`,
        [tokenHash, salonId]
      );
      if (lockRes.rows.length === 0) {
        return {
          ok: false as const,
          statusCode: 404,
          error: 'This booking management link has expired or been revoked.',
        };
      }
      const row = lockRes.rows[0];
      if (row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) {
        return {
          ok: false as const,
          statusCode: 404,
          error: 'This booking management link has expired or been revoked.',
        };
      }
      if (row.status === 'COMPLETED' || row.status === 'CANCELED' || row.status === 'NO_SHOW') {
        return {
          ok: false as const,
          statusCode: 409,
          error: 'Completed or canceled bookings cannot be rescheduled.',
        };
      }

      const currentBooking = mapRawBookingRow(row);
      const snapshot = await queryAvailabilitySnapshotWithClient(client, {
        salonId,
        windowStartIso: params.windowStartIso,
        windowEndIso: params.windowEndIso,
        excludeBookingId: currentBooking.id,
      });
      if (!snapshot) {
        return {
          ok: false as const,
          statusCode: 404,
          error: 'Salon configuration not found.',
        };
      }

      const slotChoice = params.resolveSlot(snapshot, currentBooking);
      if (!slotChoice.ok) {
        return {
          ok: false as const,
          statusCode: slotChoice.statusCode,
          error: slotChoice.error,
        };
      }

      const styRes = await client.query<{ id: string }>(
        `SELECT id
         FROM stylists
         WHERE salon_id = $1
           AND LOWER(BTRIM(name)) = LOWER(BTRIM($2))
           AND active = TRUE
         LIMIT 1`,
        [salonId, slotChoice.barberName]
      );
      if (styRes.rows.length === 0) {
        return {
          ok: false as const,
          statusCode: 409,
          error: 'Selected stylist is not available at this salon.',
        };
      }
      const nextStylistId = styRes.rows[0].id;

      await client.query(
        `UPDATE bookings
         SET stylist_id = $1,
             starts_at = $2::timestamptz,
             ends_at = $3::timestamptz
         WHERE id = $4 AND salon_id = $5`,
        [nextStylistId, slotChoice.startUtcIso, slotChoice.endUtcIso, currentBooking.id, salonId]
      );

      const nextExpiresIso = new Date(
        new Date(slotChoice.endUtcIso).getTime() + 7 * 86400000
      ).toISOString();
      await client.query(
        `UPDATE booking_access_tokens
         SET expires_at = $1::timestamptz
         WHERE id = $2 AND salon_id = $3`,
        [nextExpiresIso, row.token_id, salonId]
      );

      const oldSummary = `${currentBooking.startsAtIso} (${currentBooking.stylistName})`;
      const newSummary = `${params.appointmentDate} ${slotChoice.formattedTime} (${slotChoice.barberName})`;

      await client.query(
        `INSERT INTO booking_audit_log (salon_id, booking_id, actor_type, action, previous_state, new_state)
         VALUES ($1, $2, 'CUSTOMER', 'RESCHEDULED', $3::jsonb, $4::jsonb)`,
        [
          salonId,
          currentBooking.id,
          JSON.stringify({
            startsAt: currentBooking.startsAtIso,
            endsAt: currentBooking.endsAtIso,
            stylist: currentBooking.stylistName,
          }),
          JSON.stringify({
            startsAt: slotChoice.startUtcIso,
            endsAt: slotChoice.endUtcIso,
            stylist: slotChoice.barberName,
            summary: newSummary,
          }),
        ]
      );

      await client.query(
        `INSERT INTO counter_notifications (salon_id, booking_id, event_type, title, speech_text)
         VALUES ($1, $2, 'RESCHEDULED', $3, $4)`,
        [
          salonId,
          currentBooking.id,
          `Rescheduled: ${currentBooking.clientName}`,
          `${currentBooking.clientName} rescheduled to ${newSummary}.`,
        ]
      );

      const updatedRes = await client.query<RawJoinedBookingRow>(
        `${JOINED_BOOKING_SELECT} WHERE b.id = $1 AND b.salon_id = $2 LIMIT 1`,
        [currentBooking.id, salonId]
      );
      const updatedBooking =
        updatedRes.rows.length > 0
          ? mapRawBookingRow(updatedRes.rows[0])
          : {
              ...currentBooking,
              stylistId: nextStylistId,
              stylistName: slotChoice.barberName,
              startsAtIso: slotChoice.startUtcIso,
              endsAtIso: slotChoice.endUtcIso,
            };

      return {
        ok: true as const,
        booking: updatedBooking,
        oldSummary,
        newSummary,
      };
    });
  } catch (err: unknown) {
    if (err instanceof PgContextError) throw err;
    const pgErr = err as { code?: string };
    if (pgErr?.code === '23P01') {
      return {
        ok: false,
        statusCode: 409,
        error: 'That stylist was just booked for this time slot. Please choose another open slot.',
      };
    }
    console.error('Postgres customer reschedule failed (fail-closed):', err);
    return {
      ok: false,
      statusCode: 503,
      error: 'Could not commit reschedule cleanly to database. Please retry.',
    };
  }
}

export async function cancelBookingByAccessTokenInPostgres(params: {
  rawToken: string;
  reason?: string;
}): Promise<
  | { ok: true; booking: PgBookingRecord; alreadyCanceled: boolean }
  | { ok: false; statusCode: number; error: string }
> {
  const publicCode = parseBookingAccessTokenPublicCode(params.rawToken);
  if (!publicCode) {
    return {
      ok: false,
      statusCode: 404,
      error: 'This booking management link has expired or been revoked.',
    };
  }

  const pool = getPgPool();
  if (!pool) {
    return {
      ok: false,
      statusCode: 503,
      error: 'Database is not configured. Booking cannot be canceled without persistent storage.',
    };
  }

  const tokenHash = hashAccessToken(params.rawToken);
  try {
    return await withPgTransaction(createPublicFlowLookupActor(), async (client) => {
      await setPublicFlowScopedGucs(client, { publicCode });
      const salonRes = await client.query<{ id: string }>(
        'SELECT id FROM salons WHERE public_code = $1 LIMIT 1',
        [publicCode]
      );
      if (salonRes.rows.length === 0) {
        return {
          ok: false as const,
          statusCode: 404,
          error: 'This booking management link has expired or been revoked.',
        };
      }
      const salonId = salonRes.rows[0].id;

      await narrowPublicFlowSalonContext(client, salonId);
      await setPublicFlowScopedGucs(client, { tokenHash });

      const lockRes = await client.query<
        RawJoinedBookingRow & {
          revoked_at: string | Date | null;
          expires_at: string | Date;
        }
      >(
        `SELECT bat.revoked_at, bat.expires_at,
                b.id, b.salon_id, s.public_code AS salon_public_code, s.salon_name,
                s.public_contact_phone, s.public_whatsapp_phone, s.whatsapp_phone,
                s.timezone_offset_hours, s.currency_symbol, s.default_lang,
                s.address, s.google_maps_url, s.google_review_url,
                b.client_id, c.name AS client_name, COALESCE(NULLIF(c.phone_e164, ''), c.phone) AS client_phone,
                COALESCE(NULLIF(c.preferred_lang, ''), c.preferred_language) AS preferred_language,
                b.stylist_id, st.name AS stylist_name, b.booking_ref,
                b.services_snapshot, b.total_price, b.total_duration_mins,
                b.starts_at, b.ends_at, b.status, b.source, b.deal_id,
                b.idempotency_key, b.proof_hash, b.completed_at, b.created_at
         FROM booking_access_tokens bat
         JOIN bookings b ON b.id = bat.booking_id AND b.salon_id = bat.salon_id
         JOIN salons s ON s.id = b.salon_id
         JOIN clients c ON c.id = b.client_id
         JOIN stylists st ON st.id = b.stylist_id
         WHERE bat.token_hash = $1 AND bat.salon_id = $2
         FOR UPDATE OF b, bat`,
        [tokenHash, salonId]
      );
      if (lockRes.rows.length === 0) {
        return {
          ok: false as const,
          statusCode: 404,
          error: 'This booking management link has expired or been revoked.',
        };
      }
      const row = lockRes.rows[0];
      if (row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) {
        return {
          ok: false as const,
          statusCode: 404,
          error: 'This booking management link has expired or been revoked.',
        };
      }
      if (row.status === 'COMPLETED' || row.status === 'NO_SHOW') {
        return {
          ok: false as const,
          statusCode: 409,
          error: 'Completed appointments cannot be canceled.',
        };
      }

      const currentBooking = mapRawBookingRow(row);
      const alreadyCanceled = currentBooking.status === 'CANCELED';

      if (!alreadyCanceled) {
        await client.query(
          `UPDATE bookings
           SET status = 'CANCELED'
           WHERE id = $1 AND salon_id = $2`,
          [currentBooking.id, salonId]
        );

        await client.query(
          `INSERT INTO booking_audit_log (salon_id, booking_id, actor_type, action, previous_state, new_state)
           VALUES ($1, $2, 'CUSTOMER', 'CANCELED', $3::jsonb, $4::jsonb)`,
          [
            salonId,
            currentBooking.id,
            JSON.stringify({ status: currentBooking.status }),
            JSON.stringify({ status: 'CANCELED', reason: params.reason || 'Self-service cancel' }),
          ]
        );

        await client.query(
          `INSERT INTO counter_notifications (salon_id, booking_id, event_type, title, speech_text)
           VALUES ($1, $2, 'CANCELED', $3, $4)`,
          [
            salonId,
            currentBooking.id,
            `Canceled: ${currentBooking.clientName}`,
            `${currentBooking.clientName} canceled booking with ${currentBooking.stylistName}.`,
          ]
        );
      }

      const updatedRes = await client.query<RawJoinedBookingRow>(
        `${JOINED_BOOKING_SELECT} WHERE b.id = $1 AND b.salon_id = $2 LIMIT 1`,
        [currentBooking.id, salonId]
      );
      const updatedBooking =
        updatedRes.rows.length > 0
          ? mapRawBookingRow(updatedRes.rows[0])
          : { ...currentBooking, status: 'CANCELED' as const };

      return { ok: true as const, booking: updatedBooking, alreadyCanceled };
    });
  } catch (err) {
    if (err instanceof PgContextError) throw err;
    console.error('Postgres customer cancel failed (fail-closed):', err);
    return {
      ok: false,
      statusCode: 503,
      error: 'Could not commit cancellation cleanly to database. Please retry.',
    };
  }
}

export async function rescheduleBookingByOwnerInPostgres(
  params: {
    salonId: string;
    bookingId: string;
    appointmentDate: string;
    windowStartIso: string;
    windowEndIso: string;
    resolveSlot: SlotResolverFn;
  },
  actor: PgActorContext
): Promise<
  | { ok: true; booking: PgBookingRecord; oldSummary: string; newSummary: string }
  | { ok: false; statusCode: number; error: string }
> {
  assertOwnerOrFounderActor(actor, params.salonId, 'rescheduleAppointmentByOwner');

  const pool = getPgPool();
  if (!pool) {
    return {
      ok: false,
      statusCode: 503,
      error: 'Database is not configured. Reschedule cannot be committed without persistent storage.',
    };
  }

  try {
    return await withPgTransaction(actor, async (client) => {
      const lockRes = await client.query<RawJoinedBookingRow>(
        `${JOINED_BOOKING_SELECT}
         WHERE b.salon_id = $1 AND (b.booking_ref = $2 OR b.id::text = $2)
         FOR UPDATE OF b`,
        [params.salonId, params.bookingId]
      );
      if (lockRes.rows.length === 0) {
        return {
          ok: false as const,
          statusCode: 404,
          error: 'Appointment not found for this salon.',
        };
      }
      const currentBooking = mapRawBookingRow(lockRes.rows[0]);
      if (
        currentBooking.status === 'COMPLETED' ||
        currentBooking.status === 'CANCELED' ||
        currentBooking.status === 'NO_SHOW'
      ) {
        return {
          ok: false as const,
          statusCode: 409,
          error: 'Completed or canceled appointments cannot be rescheduled.',
        };
      }

      const snapshot = await queryAvailabilitySnapshotWithClient(client, {
        salonId: params.salonId,
        windowStartIso: params.windowStartIso,
        windowEndIso: params.windowEndIso,
        excludeBookingId: currentBooking.id,
      });
      if (!snapshot) {
        return {
          ok: false as const,
          statusCode: 404,
          error: 'Salon configuration not found.',
        };
      }

      const slotChoice = params.resolveSlot(snapshot, currentBooking);
      if (!slotChoice.ok) {
        return {
          ok: false as const,
          statusCode: slotChoice.statusCode,
          error: slotChoice.error,
        };
      }

      const styRes = await client.query<{ id: string }>(
        `INSERT INTO stylists (salon_id, name)
         VALUES ($1, $2)
         ON CONFLICT (salon_id, name) DO UPDATE SET active = TRUE
         RETURNING id`,
        [params.salonId, slotChoice.barberName]
      );
      const nextStylistId = styRes.rows[0].id;

      await client.query(
        `UPDATE bookings
         SET stylist_id = $1,
             starts_at = $2::timestamptz,
             ends_at = $3::timestamptz
         WHERE id = $4 AND salon_id = $5`,
        [
          nextStylistId,
          slotChoice.startUtcIso,
          slotChoice.endUtcIso,
          currentBooking.id,
          params.salonId,
        ]
      );

      const oldSummary = `${currentBooking.startsAtIso} (${currentBooking.stylistName})`;
      const newSummary = `${params.appointmentDate} ${slotChoice.formattedTime} (${slotChoice.barberName})`;

      await client.query(
        `INSERT INTO booking_audit_log (salon_id, booking_id, actor_type, action, previous_state, new_state)
         VALUES ($1, $2, 'OWNER', 'RESCHEDULED', $3::jsonb, $4::jsonb)`,
        [
          params.salonId,
          currentBooking.id,
          JSON.stringify({
            startsAt: currentBooking.startsAtIso,
            endsAt: currentBooking.endsAtIso,
            stylist: currentBooking.stylistName,
          }),
          JSON.stringify({
            startsAt: slotChoice.startUtcIso,
            endsAt: slotChoice.endUtcIso,
            stylist: slotChoice.barberName,
            summary: newSummary,
          }),
        ]
      );

      await client.query(
        `INSERT INTO counter_notifications (salon_id, booking_id, event_type, title, speech_text)
         VALUES ($1, $2, 'RESCHEDULED', $3, $4)`,
        [
          params.salonId,
          currentBooking.id,
          `Owner Rescheduled: ${currentBooking.clientName}`,
          `${currentBooking.clientName} moved to ${newSummary}.`,
        ]
      );

      const updatedRes = await client.query<RawJoinedBookingRow>(
        `${JOINED_BOOKING_SELECT} WHERE b.id = $1 AND b.salon_id = $2 LIMIT 1`,
        [currentBooking.id, params.salonId]
      );
      const updatedBooking =
        updatedRes.rows.length > 0
          ? mapRawBookingRow(updatedRes.rows[0])
          : {
              ...currentBooking,
              stylistId: nextStylistId,
              stylistName: slotChoice.barberName,
              startsAtIso: slotChoice.startUtcIso,
              endsAtIso: slotChoice.endUtcIso,
            };

      return { ok: true as const, booking: updatedBooking, oldSummary, newSummary };
    });
  } catch (err: unknown) {
    if (err instanceof PgContextError) throw err;
    const pgErr = err as { code?: string };
    if (pgErr?.code === '23P01') {
      return {
        ok: false,
        statusCode: 409,
        error: 'That stylist was just booked for this time slot. Please choose another open slot.',
      };
    }
    console.error('Postgres owner reschedule failed (fail-closed):', err);
    return {
      ok: false,
      statusCode: 503,
      error: 'Could not commit reschedule cleanly to database. Please retry.',
    };
  }
}

export async function updateBookingStatusInPostgres(
  params: {
    salonId: string;
    bookingId: string;
    nextStatus: 'CONFIRMED' | 'IN_CHAIR' | 'COMPLETED' | 'CANCELED';
  },
  actor: PgActorContext
): Promise<
  | { ok: true; booking: PgBookingRecord; changed: boolean }
  | { ok: false; statusCode: number; error: string }
> {
  assertOwnerOrFounderActor(actor, params.salonId, 'updateAppointmentStatus');

  const pool = getPgPool();
  if (!pool) {
    return {
      ok: false,
      statusCode: 503,
      error: 'Database is not configured. Status update cannot be committed without persistent storage.',
    };
  }

  try {
    return await withPgTransaction(actor, async (client) => {
      const lockRes = await client.query<RawJoinedBookingRow>(
        `${JOINED_BOOKING_SELECT}
         WHERE b.salon_id = $1 AND (b.booking_ref = $2 OR b.id::text = $2)
         FOR UPDATE OF b`,
        [params.salonId, params.bookingId]
      );
      if (lockRes.rows.length === 0) {
        return {
          ok: false as const,
          statusCode: 404,
          error: 'Appointment not found for this salon.',
        };
      }

      const currentBooking = mapRawBookingRow(lockRes.rows[0]);
      const prevStatus = currentBooking.status;

      if (prevStatus === 'COMPLETED' && params.nextStatus !== 'COMPLETED') {
        return {
          ok: false as const,
          statusCode: 409,
          error: `Completed appointments cannot transition to ${params.nextStatus}.`,
        };
      }
      if (prevStatus === 'CANCELED' && params.nextStatus !== 'CANCELED') {
        return {
          ok: false as const,
          statusCode: 409,
          error: 'Canceled appointments cannot be reopened.',
        };
      }
      if (prevStatus === 'NO_SHOW') {
        return {
          ok: false as const,
          statusCode: 409,
          error: 'No-show appointments cannot transition.',
        };
      }

      if (prevStatus === params.nextStatus) {
        return { ok: true as const, booking: currentBooking, changed: false };
      }

      const nowIso = new Date().toISOString();
      await client.query(
        `UPDATE bookings
         SET status = $1,
             completed_at = CASE WHEN $1 = 'COMPLETED' THEN COALESCE(completed_at, $2::timestamptz) ELSE completed_at END
         WHERE id = $3 AND salon_id = $4`,
        [params.nextStatus, nowIso, currentBooking.id, params.salonId]
      );

      if (params.nextStatus === 'COMPLETED') {
        await client.query(
          `UPDATE clients
           SET last_completed_visit_at = $1::timestamptz,
               total_visits = total_visits + 1,
               updated_at = NOW()
           WHERE id = $2 AND salon_id = $3`,
          [nowIso, currentBooking.clientId, params.salonId]
        );
      }

      const auditAction: PgBookingAuditRow['action'] =
        params.nextStatus === 'CANCELED'
          ? 'CANCELED'
          : params.nextStatus === 'COMPLETED'
          ? 'COMPLETED'
          : params.nextStatus === 'IN_CHAIR'
          ? 'IN_CHAIR'
          : 'CREATED';

      await client.query(
        `INSERT INTO booking_audit_log (salon_id, booking_id, actor_type, action, previous_state, new_state)
         VALUES ($1, $2, 'OWNER', $3, $4::jsonb, $5::jsonb)`,
        [
          params.salonId,
          currentBooking.id,
          auditAction,
          JSON.stringify({ status: prevStatus }),
          JSON.stringify({
            status: params.nextStatus,
            completedAt: params.nextStatus === 'COMPLETED' ? nowIso : null,
          }),
        ]
      );

      if (params.nextStatus === 'CANCELED') {
        await client.query(
          `INSERT INTO counter_notifications (salon_id, booking_id, event_type, title, speech_text)
           VALUES ($1, $2, 'CANCELED', $3, $4)`,
          [
            params.salonId,
            currentBooking.id,
            `Canceled: ${currentBooking.clientName}`,
            `Appointment for ${currentBooking.clientName} marked canceled.`,
          ]
        );
      }

      const updatedRes = await client.query<RawJoinedBookingRow>(
        `${JOINED_BOOKING_SELECT} WHERE b.id = $1 AND b.salon_id = $2 LIMIT 1`,
        [currentBooking.id, params.salonId]
      );
      const updatedBooking =
        updatedRes.rows.length > 0
          ? mapRawBookingRow(updatedRes.rows[0])
          : {
              ...currentBooking,
              status: params.nextStatus,
              completedAtIso: params.nextStatus === 'COMPLETED' ? nowIso : currentBooking.completedAtIso,
            };

      return { ok: true as const, booking: updatedBooking, changed: true };
    });
  } catch (err: unknown) {
    if (err instanceof PgContextError) throw err;
    const pgErr = err as { code?: string };
    if (pgErr?.code === '23P01') {
      return {
        ok: false,
        statusCode: 409,
        error: 'Stylist already has an active overlapping appointment.',
      };
    }
    console.error('Postgres status update failed (fail-closed):', err);
    return {
      ok: false,
      statusCode: 503,
      error: 'Could not update appointment status in database.',
    };
  }
}

export async function completeAppointmentAndRecordVisitInPostgres(
  params: {
    salonId: string;
    appointmentId: string;
    clientName: string;
    clientPhone: string;
    barberName: string;
    service: string;
    price: number;
    birthDate?: string;
    preferredLanguage: string;
    startsAtIso: string;
    endsAtIso: string;
    proofHash: string;
  },
  actor: PgActorContext
): Promise<
  | { ok: true; booking: PgBookingRecord; client: PgClientVisitRecord }
  | { ok: false; statusCode: number; error: string }
> {
  assertOwnerOrFounderActor(actor, params.salonId, 'completeAppointmentAndRecordVisit');

  const pool = getPgPool();
  if (!pool) {
    return {
      ok: false,
      statusCode: 503,
      error: 'Database is not configured. Completion cannot be recorded without persistent storage.',
    };
  }

  try {
    return await withPgTransaction(actor, async (client) => {
      const lockRes = await client.query<RawJoinedBookingRow>(
        `${JOINED_BOOKING_SELECT}
         WHERE b.salon_id = $1 AND (b.booking_ref = $2 OR b.id::text = $2)
         FOR UPDATE OF b`,
        [params.salonId, params.appointmentId]
      );

      const existing = lockRes.rows.length > 0 ? mapRawBookingRow(lockRes.rows[0]) : null;
      if (existing && (existing.status === 'CANCELED' || existing.status === 'NO_SHOW')) {
        return {
          ok: false as const,
          statusCode: 409,
          error: 'Canceled appointments cannot be completed.',
        };
      }

      const alreadyCompleted = existing?.status === 'COMPLETED';
      const nowIso = new Date().toISOString();
      const cleanBirthDate = (params.birthDate || '').trim();
      let clientRow: PgClientVisitRecord;
      let bookingUuid: string;

      if (existing) {
        const cliUpdateRes = await client.query<{
          id: string;
          salon_id: string;
          name: string;
          phone: string;
          preferred_language: string | null;
          birth_date: string;
          last_completed_visit_at: string | Date | null;
          total_visits: number;
        }>(
          `UPDATE clients
           SET name = COALESCE(NULLIF($1, ''), name),
               birth_date = CASE WHEN $2 <> '' THEN $2 ELSE birth_date END,
               birth_day_month = CASE WHEN $2 <> '' THEN $2 ELSE birth_day_month END,
               last_completed_visit_at = CASE WHEN $3 THEN last_completed_visit_at ELSE $4::timestamptz END,
               total_visits = CASE WHEN $3 THEN total_visits ELSE total_visits + 1 END,
               updated_at = NOW()
           WHERE id = $5 AND salon_id = $6
           RETURNING id, salon_id, name, COALESCE(NULLIF(phone_e164, ''), phone) AS phone,
                     COALESCE(NULLIF(preferred_lang, ''), preferred_language) AS preferred_language,
                     birth_date, last_completed_visit_at, total_visits`,
          [
            params.clientName,
            cleanBirthDate,
            alreadyCompleted,
            nowIso,
            existing.clientId,
            params.salonId,
          ]
        );
        const cRow = cliUpdateRes.rows[0];
        clientRow = {
          id: cRow.id,
          salonId: cRow.salon_id,
          name: cRow.name,
          phone: cRow.phone,
          preferredLanguage: cRow.preferred_language,
          birthDate: cRow.birth_date || '',
          lastCompletedVisitAt: cRow.last_completed_visit_at
            ? toIsoString(cRow.last_completed_visit_at)
            : null,
          totalVisits: Number(cRow.total_visits ?? 0),
        };

        if (!alreadyCompleted) {
          await client.query(
            `UPDATE bookings
             SET status = 'COMPLETED',
                 completed_at = COALESCE(completed_at, $1::timestamptz)
             WHERE id = $2 AND salon_id = $3`,
            [nowIso, existing.id, params.salonId]
          );
        }
        bookingUuid = existing.id;
      } else {
        const generatedClientId = `cli-${Date.now().toString(36)}-${crypto
          .randomBytes(3)
          .toString('hex')}`;
        const cliUpsertRes = await client.query<{
          id: string;
          salon_id: string;
          name: string;
          phone: string;
          preferred_language: string | null;
          birth_date: string;
          last_completed_visit_at: string | Date | null;
          total_visits: number;
        }>(
          `INSERT INTO clients (
             id, salon_id, name, phone, phone_e164, preferred_language, preferred_lang,
             awaiting_language_selection, birth_date, birth_day_month,
             last_completed_visit_at, total_visits
           )
           VALUES ($1, $2, $3, $4, $4, $5, $5, FALSE, $6, $6, $7::timestamptz, 1)
           ON CONFLICT (salon_id, phone_e164) DO UPDATE SET
             name = COALESCE(NULLIF(EXCLUDED.name, ''), clients.name),
             birth_date = CASE WHEN EXCLUDED.birth_date <> '' THEN EXCLUDED.birth_date ELSE clients.birth_date END,
             birth_day_month = CASE WHEN EXCLUDED.birth_day_month <> '' THEN EXCLUDED.birth_day_month ELSE clients.birth_day_month END,
             last_completed_visit_at = EXCLUDED.last_completed_visit_at,
             total_visits = clients.total_visits + 1,
             updated_at = NOW()
           RETURNING id, salon_id, name, COALESCE(NULLIF(phone_e164, ''), phone) AS phone,
                     COALESCE(NULLIF(preferred_lang, ''), preferred_language) AS preferred_language,
                     birth_date, last_completed_visit_at, total_visits`,
          [
            generatedClientId,
            params.salonId,
            params.clientName,
            params.clientPhone,
            params.preferredLanguage,
            cleanBirthDate,
            nowIso,
          ]
        );
        const cRow = cliUpsertRes.rows[0];
        clientRow = {
          id: cRow.id,
          salonId: cRow.salon_id,
          name: cRow.name,
          phone: cRow.phone,
          preferredLanguage: cRow.preferred_language,
          birthDate: cRow.birth_date || '',
          lastCompletedVisitAt: cRow.last_completed_visit_at
            ? toIsoString(cRow.last_completed_visit_at)
            : null,
          totalVisits: Number(cRow.total_visits ?? 1),
        };

        const styRes = await client.query<{ id: string }>(
          `INSERT INTO stylists (salon_id, name)
           VALUES ($1, $2)
           ON CONFLICT (salon_id, name) DO UPDATE SET active = TRUE
           RETURNING id`,
          [params.salonId, params.barberName]
        );
        const stylistUuid = styRes.rows[0].id;

        const bkInsertRes = await client.query<{ id: string }>(
          `INSERT INTO bookings (
             salon_id, client_id, stylist_id, booking_ref, services_snapshot,
             total_price, total_duration_mins, starts_at, ends_at,
             status, source, proof_hash, completed_at
           )
           VALUES (
             $1, $2, $3, $4, $5::jsonb,
             $6, 35, $7::timestamptz, $8::timestamptz,
             'COMPLETED', 'OWNER_WALKIN', $9, $10::timestamptz
           )
           RETURNING id`,
          [
            params.salonId,
            clientRow.id,
            stylistUuid,
            params.appointmentId,
            JSON.stringify([{ name: params.service, price: params.price, durationMins: 35 }]),
            params.price,
            params.startsAtIso,
            params.endsAtIso,
            params.proofHash,
            nowIso,
          ]
        );
        bookingUuid = bkInsertRes.rows[0].id;
      }

      if (!alreadyCompleted) {
        await client.query(
          `INSERT INTO booking_audit_log (salon_id, booking_id, actor_type, action, previous_state, new_state)
           VALUES ($1, $2, 'OWNER', 'COMPLETED', $3::jsonb, $4::jsonb)`,
          [
            params.salonId,
            bookingUuid,
            JSON.stringify({ status: existing?.status || 'NONE' }),
            JSON.stringify({ status: 'COMPLETED', completedAt: nowIso, clientId: clientRow.id }),
          ]
        );
      }

      const finalBookingRes = await client.query<RawJoinedBookingRow>(
        `${JOINED_BOOKING_SELECT} WHERE b.id = $1 AND b.salon_id = $2 LIMIT 1`,
        [bookingUuid, params.salonId]
      );
      const booking =
        finalBookingRes.rows.length > 0
          ? mapRawBookingRow(finalBookingRes.rows[0])
          : ({
              id: bookingUuid,
              salonId: params.salonId,
              salonPublicCode: '',
              salonName: '',
              publicContactPhone: '',
              whatsappPhone: '',
              timezoneOffsetHours: 5,
              currencySymbol: 'PKR ',
              defaultLang: 'en',
              address: '',
              googleMapsUrl: '',
              googleReviewUrl: '',
              clientId: clientRow.id,
              clientName: clientRow.name,
              clientPhone: clientRow.phone,
              preferredLanguage: clientRow.preferredLanguage,
              stylistId: '',
              stylistName: params.barberName,
              bookingRef: params.appointmentId,
              servicesSnapshot: [{ name: params.service, price: params.price, durationMins: 35 }],
              totalPrice: params.price,
              totalDurationMins: 35,
              startsAtIso: params.startsAtIso,
              endsAtIso: params.endsAtIso,
              status: 'COMPLETED',
              source: 'OWNER_WALKIN',
              dealId: null,
              proofHash: params.proofHash,
              completedAtIso: nowIso,
              createdAtIso: nowIso,
            } satisfies PgBookingRecord);

      return { ok: true as const, booking, client: clientRow };
    });
  } catch (err) {
    if (err instanceof PgContextError) throw err;
    console.error('Postgres completeAppointmentAndRecordVisit failed (fail-closed):', err);
    return {
      ok: false,
      statusCode: 503,
      error: 'Could not complete appointment and record visit in database.',
    };
  }
}

export async function listSalonBookingsFromPostgres(
  salonId: string,
  actor: PgActorContext
): Promise<{ bookings: PgBookingRecord[]; auditLog: PgBookingAuditRow[] } | null> {
  assertOwnerOrFounderActor(actor, salonId, 'listSalonBookings');
  const pool = getPgPool();
  if (!pool) return null;

  return await withPgTransaction(actor, async (client) => {
    const bkRes = await client.query<RawJoinedBookingRow>(
      `${JOINED_BOOKING_SELECT}
       WHERE b.salon_id = $1
       ORDER BY b.starts_at DESC
       LIMIT 200`,
      [salonId]
    );
    const auditRes = await client.query<{
      id: string;
      salon_id: string;
      booking_id: string;
      actor_type: 'CUSTOMER' | 'OWNER' | 'SYSTEM';
      action: 'CREATED' | 'RESCHEDULED' | 'CANCELED' | 'IN_CHAIR' | 'COMPLETED';
      new_state: Record<string, unknown> | null;
      created_at: string | Date;
    }>(
      `SELECT id, salon_id, booking_id, actor_type, action, new_state, created_at
       FROM booking_audit_log
       WHERE salon_id = $1
       ORDER BY created_at DESC
       LIMIT 80`,
      [salonId]
    );

    return {
      bookings: bkRes.rows.map(mapRawBookingRow),
      auditLog: auditRes.rows.map((r) => ({
        id: r.id,
        salonId: r.salon_id,
        bookingId: r.booking_id,
        actorType: r.actor_type,
        action: r.action,
        note:
          typeof r.new_state?.summary === 'string'
            ? r.new_state.summary
            : `${r.action} (${r.actor_type})`,
        createdAt: toIsoString(r.created_at),
      })),
    };
  });
}

