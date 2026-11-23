/**
 * Managed PostgreSQL Repository & Transactional Booking Guard
 *
 * Uses `pg` Pool when DATABASE_URL / POSTGRES_URL is configured.
 * Provides:
 *  - Transactional booking inserts with Postgres exclusion constraint handling (23P01)
 *  - Idempotency key deduplication
 *  - Atomic monthly booking quota updates (`salon_usage_monthly`)
 *  - Revocable signed access tokens (`booking_access_tokens`) and `booking_audit_log`
 *  - Strict `salon_id` isolation across every query
 */

import { Pool, type PoolClient } from 'pg';

declare global {
  var _workcraftPgPool: Pool | undefined;
}

export function getDatabaseUrl(): string {
  return (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
}

export function isPostgresConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}

export function assertProductionDatabaseReady(): { ok: true } | { ok: false; error: string } {
  if (process.env.NODE_ENV === 'production' && !isPostgresConfigured()) {
    return {
      ok: false,
      error:
        'DATABASE_URL (managed PostgreSQL) is required in production. Ephemeral JSON/tmp storage is disabled in production.',
    };
  }
  return { ok: true };
}

export function getPgPool(): Pool | null {
  const connectionString = getDatabaseUrl();
  if (!connectionString) return null;
  if (!global._workcraftPgPool) {
    global._workcraftPgPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
      ssl:
        /localhost|127\.0\.0\.1/i.test(connectionString)
          ? undefined
          : { rejectUnauthorized: false },
    });
    global._workcraftPgPool.on('error', (err) => {
      console.error('PostgreSQL pool idle error:', err);
    });
  }
  return global._workcraftPgPool;
}

export async function withPgTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPgPool();
  if (!pool) {
    throw new Error('PostgreSQL pool unavailable: DATABASE_URL is not configured.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
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

export async function persistPostgresSnapshotMirror(params: {
  salonId: string;
  publicCode: string;
  salonName: string;
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
}): Promise<void> {
  const pool = getPgPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO salons (
         id, public_code, salon_name, salon_category, owner_auth_phone, public_contact_phone,
         public_whatsapp_phone, timezone_iana, timezone_offset_hours, currency_code, currency_symbol,
         default_lang, enabled_langs, plan_tier, monthly_booking_limit, billing_status,
         whatsapp_addon_enabled, address, google_maps_url, google_review_url
       )
       VALUES (
         gen_random_uuid(), $1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10,
         $11, $12::text[], $13, $14, $15,
         FALSE, $16, $17, $18
       )
       ON CONFLICT (public_code) DO UPDATE SET
         salon_name = EXCLUDED.salon_name,
         salon_category = EXCLUDED.salon_category,
         public_contact_phone = EXCLUDED.public_contact_phone,
         public_whatsapp_phone = EXCLUDED.public_whatsapp_phone,
         timezone_iana = EXCLUDED.timezone_iana,
         timezone_offset_hours = EXCLUDED.timezone_offset_hours,
         currency_code = EXCLUDED.currency_code,
         currency_symbol = EXCLUDED.currency_symbol,
         default_lang = EXCLUDED.default_lang,
         enabled_langs = EXCLUDED.enabled_langs,
         plan_tier = EXCLUDED.plan_tier,
         monthly_booking_limit = EXCLUDED.monthly_booking_limit,
         billing_status = EXCLUDED.billing_status,
         address = EXCLUDED.address,
         google_maps_url = EXCLUDED.google_maps_url,
         google_review_url = EXCLUDED.google_review_url,
         updated_at = NOW()`,
      [
        params.publicCode,
        params.salonName,
        params.salonCategory === 'LADIES' ? 'LADIES' : 'MENS',
        params.ownerAuthPhone,
        params.publicContactPhone,
        params.publicWhatsappPhone || null,
        params.timezoneIana,
        Number.isFinite(params.timezoneOffsetHours) ? params.timezoneOffsetHours : 5,
        params.currencyCode,
        params.currencySymbol,
        params.defaultLang || 'en',
        Array.isArray(params.enabledLangs) && params.enabledLangs.length > 0
          ? params.enabledLangs
          : ['en', 'roman_ur', 'ur'],
        params.planTier,
        params.monthlyLimit,
        params.billingStatus,
        params.address || '',
        params.googleMapsUrl || '',
        params.googleReviewUrl || '',
      ]
    );
  } catch (err) {
    console.warn('Postgres salon sync skipped (run migration 002_web_first_production.sql if tables missing):', err);
  }
}

export async function findSalonByPublicCodeInPostgres(
  publicCode: string
): Promise<PostgresSalonLookupRow | null> {
  const pool = getPgPool();
  if (!pool) return null;
  try {
    const res = await pool.query<{
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
      [publicCode]
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
  } catch (err) {
    console.warn('Postgres public_code lookup skipped:', err);
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
  const pool = getPgPool();
  if (!pool) return { ok: true };
  try {
    return await withPgTransaction(async (client) => {
      const salonRes = await client.query<{ id: string }>(
        'SELECT id FROM salons WHERE public_code = $1 LIMIT 1',
        [params.salonPublicCode]
      );
      if (salonRes.rows.length === 0) return { ok: true };
      const salonUuid = salonRes.rows[0].id;

      const cliRes = await client.query<{ id: string }>(
        `INSERT INTO clients (salon_id, name, phone_e164, preferred_lang)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (salon_id, phone_e164) DO UPDATE SET
           preferred_lang = EXCLUDED.preferred_lang,
           updated_at = NOW()
         RETURNING id`,
        [salonUuid, params.clientName, params.clientPhoneE164, params.preferredLang]
      );
      const clientUuid = cliRes.rows[0].id;

      const styRes = await client.query<{ id: string }>(
        `INSERT INTO stylists (salon_id, name)
         VALUES ($1, $2)
         ON CONFLICT (salon_id, name) DO UPDATE SET active = TRUE
         RETURNING id`,
        [salonUuid, params.stylistName]
      );
      const stylistUuid = styRes.rows[0].id;

      if (params.idempotencyKey) {
        const dup = await client.query(
          `SELECT id FROM bookings WHERE salon_id = $1 AND idempotency_key = $2 LIMIT 1`,
          [salonUuid, params.idempotencyKey]
        );
        if (dup.rows.length > 0) return { ok: true };
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
          salonUuid,
          clientUuid,
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
        [params.accessTokenHash, bookingUuid, salonUuid, params.accessTokenExpiresAtIso]
      );

      await client.query(
        `INSERT INTO salon_usage_monthly (salon_id, billing_month, billable_bookings, limit_snapshot)
         VALUES ($1, $2, 1, $3)
         ON CONFLICT (salon_id, billing_month) DO UPDATE SET
           billable_bookings = salon_usage_monthly.billable_bookings + 1,
           limit_snapshot = EXCLUDED.limit_snapshot,
           updated_at = NOW()`,
        [salonUuid, params.billingMonth, params.monthlyLimit]
      );

      await client.query(
        `INSERT INTO booking_audit_log (salon_id, booking_id, actor_type, action, new_state)
         VALUES ($1, $2, 'CUSTOMER', 'CREATED', $3::jsonb)`,
        [salonUuid, bookingUuid, JSON.stringify({ startsAt: params.startsAtIso, stylist: params.stylistName })]
      );

      return { ok: true };
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
    console.warn('Postgres booking mirror note:', err);
    return { ok: true };
  }
}
