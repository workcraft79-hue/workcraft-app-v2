import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Pool } from 'pg';

import {
  recordBookingInPostgres,
  setPgPoolOverrideForTests,
} from '../server/postgresRepo.js';

/**
 * Live PostgreSQL Integration Test:
 * Exercises migration 003's `guard_bookings_public_update()` trigger together
 * with `increment_salon_monthly_booking_usage()` and `recordBookingInPostgres()`,
 * including SECURITY DEFINER hardening checks, direct PUBLIC_FLOW bypass denial,
 * successful public booking creation, and SQLSTATE P0002 quota-exceeded rollback.
 *
 * Safety Guarantees:
 *   - NEVER reads DATABASE_URL or POSTGRES_URL (zero risk to Production).
 *   - Requires EITHER:
 *       1) TEST_POSTGRES_URL + CONFIRM_INTEGRATION_TESTS=1 (local/isolated PG)
 *       2) STAGING_DATABASE_URL + EXPECTED_STAGING_DB_HOST + CONFIRM_STAGING_PG_TESTS=1
 *   - Skips cleanly when unconfigured so offline CI remains deterministic.
 */

interface ResolvedTestDbTarget {
  connectionString: string;
  host: string;
  useSsl: boolean;
}

function resolveIntegrationDbTarget(): ResolvedTestDbTarget | null {
  const localUrl = (process.env.TEST_POSTGRES_URL || '').trim();
  if (localUrl && process.env.CONFIRM_INTEGRATION_TESTS === '1') {
    const parsed = new URL(localUrl);
    if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
      throw new Error('TEST_POSTGRES_URL must use postgres:// or postgresql://');
    }
    const host = parsed.hostname.toLowerCase();
    return {
      connectionString: localUrl,
      host,
      useSsl: !/localhost|127\.0\.0\.1/i.test(host),
    };
  }

  const stagingUrl = (process.env.STAGING_DATABASE_URL || '').trim();
  const expectedHost = (process.env.EXPECTED_STAGING_DB_HOST || '').trim().toLowerCase();
  if (stagingUrl && expectedHost && process.env.CONFIRM_STAGING_PG_TESTS === '1') {
    const parsed = new URL(stagingUrl);
    if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
      throw new Error('STAGING_DATABASE_URL must use postgres:// or postgresql://');
    }
    const host = parsed.hostname.toLowerCase();
    if (!host || host !== expectedHost) {
      throw new Error(
        `Refusing to connect: STAGING_DATABASE_URL host "${host}" does not match EXPECTED_STAGING_DB_HOST "${expectedHost}".`
      );
    }
    return {
      connectionString: stagingUrl,
      host,
      useSsl: !/localhost|127\.0\.0\.1/i.test(host),
    };
  }

  return null;
}

const DB_TARGET = resolveIntegrationDbTarget();
const SKIP_REASON = DB_TARGET
  ? false
  : 'Live PostgreSQL integration tests skipped (set TEST_POSTGRES_URL + CONFIRM_INTEGRATION_TESTS=1 or STAGING_DATABASE_URL + EXPECTED_STAGING_DB_HOST + CONFIRM_STAGING_PG_TESTS=1).';

function makePool(target: ResolvedTestDbTarget): Pool {
  return new Pool({
    connectionString: target.connectionString,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: target.useSsl ? { rejectUnauthorized: false } : undefined,
  });
}

test(
  'PG Integration 1: SECURITY DEFINER functions pin search_path=pg_catalog, public, pg_temp, revoke PUBLIC EXECUTE, and have safe ownership',
  { skip: SKIP_REASON },
  async () => {
    const pool = makePool(DB_TARGET!);
    const client = await pool.connect();
    try {
      const rpcNames = [
        'public.get_public_stylist_busy_blocks(text, timestamptz, timestamptz, text)',
        'public.upsert_public_booking_client(text, text, text, text, text)',
        'public.increment_salon_monthly_booking_usage(text, uuid, text)',
      ];
      for (const sig of rpcNames) {
        const res = await client.query<{
          owner_name: string;
          secdef: boolean;
          proconfig: string[] | null;
          public_exec: boolean;
        }>(
          `SELECT
             pg_catalog.pg_get_userbyid(p.proowner)::text AS owner_name,
             p.prosecdef AS secdef,
             p.proconfig AS proconfig,
             pg_catalog.has_function_privilege('public', p.oid, 'EXECUTE') AS public_exec
           FROM pg_catalog.pg_proc p
           WHERE p.oid = pg_catalog.to_regprocedure($1)`,
          [sig]
        );
        assert.equal(res.rows.length, 1, `Expected ${sig} to exist`);
        const row = res.rows[0];
        assert.equal(row.secdef, true, `${sig} must be SECURITY DEFINER`);
        assert.notEqual(row.owner_name, 'staging_app_role', `${sig} must not be owned by staging_app_role`);
        assert.equal(row.public_exec, false, `${sig} must not grant EXECUTE to PUBLIC`);
        const cfg = (row.proconfig || []).join('|');
        assert.match(cfg, /search_path=.*pg_catalog.*public.*pg_temp/, `${sig} must pin safe search_path`);
      }

      const triggerFns = [
        'public.guard_salon_billing_status_update()',
        'public.guard_auth_challenges_update()',
        'public.guard_booking_access_tokens_public_update()',
        'public.guard_bookings_public_update()',
      ];
      for (const sig of triggerFns) {
        const res = await client.query<{
          proconfig: string[] | null;
          public_exec: boolean;
        }>(
          `SELECT
             p.proconfig AS proconfig,
             pg_catalog.has_function_privilege('public', p.oid, 'EXECUTE') AS public_exec
           FROM pg_catalog.pg_proc p
           WHERE p.oid = pg_catalog.to_regprocedure($1)`,
          [sig]
        );
        assert.equal(res.rows.length, 1, `Expected ${sig} to exist`);
        assert.equal(res.rows[0].public_exec, false, `${sig} trigger function must revoke PUBLIC EXECUTE`);
        const cfg = (res.rows[0].proconfig || []).join('|');
        assert.match(cfg, /search_path=.*pg_catalog.*public.*pg_temp/, `${sig} must pin safe search_path`);
      }
    } finally {
      client.release();
      await pool.end();
    }
  }
);

test(
  'PG Integration 2: guard_bookings_public_update rejects direct PUBLIC_FLOW usage_counted changes (even with forged internal GUC) while allowing controlled RPC usage marking',
  { skip: SKIP_REASON },
  async () => {
    const pool = makePool(DB_TARGET!);
    const client = await pool.connect();
    const suffix = crypto.randomBytes(4).toString('hex');
    const salonId = `it-trig-${suffix}`;
    const publicCode = `wc_it_${suffix}`;
    const clientId = `cli-it-${suffix}`;
    const bookingId = crypto.randomUUID();
    const tokenHash = crypto.createHash('sha256').update(`tok-${suffix}`).digest('hex');

    try {
      await client.query('BEGIN');
      await client.query(
        `SELECT set_config('app.current_user_role', 'FOUNDER', true),
                set_config('app.current_user_id', 'it-founder', true)`
      );
      await client.query(
        `INSERT INTO salons (
           id, public_code, salon_name, owner_name, whatsapp_phone, owner_auth_phone, public_contact_phone,
           package_tier, plan_tier, billing_status, monthly_booking_limit, grace_overage_limit
         )
         VALUES ($1, $2, 'Integration Salon', 'Integration Test Owner', '+923000000101', '+923000000101', '+923000000101',
                 'STARTER', 'STARTER', 'ACTIVE', 5, 0)`,
        [salonId, publicCode]
      );
      await client.query(
        `INSERT INTO clients (id, salon_id, name, phone, phone_e164)
         VALUES ($1, $2, 'Trigger Test Client', '+923000000102', '+923000000102')`,
        [clientId, salonId]
      );
      const styRes = await client.query<{ id: string }>(
        `INSERT INTO stylists (salon_id, name) VALUES ($1, 'Integration Stylist') RETURNING id`,
        [salonId]
      );
      const stylistId = styRes.rows[0].id;
      await client.query(
        `INSERT INTO bookings (
           id, salon_id, client_id, stylist_id, booking_ref, services_snapshot,
           total_price, total_duration_mins, starts_at, ends_at, status, source, proof_hash, usage_counted
         )
         VALUES (
           $1, $2, $3, $4, 'BK-IT-1', '[{"name":"Haircut","price":1000}]'::jsonb,
           1000, 30, '2026-12-10T07:00:00.000Z', '2026-12-10T07:30:00.000Z',
           'CONFIRMED', 'WEB_LINK', 'proof-it-1', FALSE
         )`,
        [bookingId, salonId, clientId, stylistId]
      );
      await client.query(
        `INSERT INTO booking_access_tokens (token_hash, booking_id, salon_id, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')`,
        [tokenHash, bookingId, salonId]
      );

      // Switch transaction context to PUBLIC_FLOW scoped to this booking + token
      await client.query(
        `SELECT
           set_config('app.current_user_role', 'PUBLIC_FLOW', true),
           set_config('app.current_salon_id', $1, true),
           set_config('app.current_booking_id', $2, true),
           set_config('app.current_token_hash', $3, true)`,
        [salonId, bookingId, tokenHash]
      );

      // 0) PUBLIC_FLOW may extend a verified token, but must never shorten its expiry.
      await client.query('SAVEPOINT sp_token_expiry_shorten');
      await assert.rejects(
        () =>
          client.query(
            `UPDATE booking_access_tokens
             SET expires_at = NOW() + INTERVAL '1 day'
             WHERE token_hash = $1`,
            [tokenHash]
          ),
        /PUBLIC_FLOW may only extend expires_at/
      );
      await client.query('ROLLBACK TO SAVEPOINT sp_token_expiry_shorten');
      await client.query('RELEASE SAVEPOINT sp_token_expiry_shorten');

      await client.query('SAVEPOINT sp_token_expiry_extend');
      await client.query(
        `UPDATE booking_access_tokens
         SET expires_at = NOW() + INTERVAL '30 days'
         WHERE token_hash = $1`,
        [tokenHash]
      );
      await client.query('RELEASE SAVEPOINT sp_token_expiry_extend');

      // 1) Direct UPDATE of usage_counted under PUBLIC_FLOW must fail even if caller tries to forge app._usage_mark_booking_id
      await client.query('SAVEPOINT sp_direct_usage');
      const roleCheck = await client.query<{ is_fn_owner: boolean }>(
        `SELECT CURRENT_USER = pg_catalog.pg_get_userbyid(p.proowner) AS is_fn_owner
         FROM pg_catalog.pg_proc p
         WHERE p.oid = pg_catalog.to_regprocedure('public.increment_salon_monthly_booking_usage(text, uuid, text)')`
      );
      if (!roleCheck.rows[0].is_fn_owner) {
        // Connected as unprivileged runtime role (e.g. staging_app_role): even setting the internal GUC must fail
        await client.query(`SELECT set_config('app._usage_mark_booking_id', $1, true)`, [bookingId]);
      }
      await assert.rejects(
        () => client.query(`UPDATE bookings SET usage_counted = TRUE WHERE id = $1`, [bookingId]),
        /PUBLIC_FLOW may not directly modify bookings\.usage_counted/
      );
      await client.query('ROLLBACK TO SAVEPOINT sp_direct_usage');
      await client.query('RELEASE SAVEPOINT sp_direct_usage');

      // 2) Other restricted booking columns (e.g. total_price) remain blocked under PUBLIC_FLOW
      await client.query('SAVEPOINT sp_restricted_col');
      await assert.rejects(
        () => client.query(`UPDATE bookings SET total_price = 1 WHERE id = $1`, [bookingId]),
        /PUBLIC_FLOW may only reschedule stylist\/time or cancel its authorized booking/
      );
      await client.query('ROLLBACK TO SAVEPOINT sp_restricted_col');
      await client.query('RELEASE SAVEPOINT sp_restricted_col');

      // 2b) Direct PUBLIC_FLOW stylists INSERT and UPDATE must fail with RLS denial
      await client.query('SAVEPOINT sp_stylist_insert');
      await assert.rejects(
        () =>
          client.query(`INSERT INTO stylists (salon_id, name) VALUES ($1, 'Rogue Public Barber')`, [
            salonId,
          ]),
        /row-level security policy for table "stylists"/
      );
      await client.query('ROLLBACK TO SAVEPOINT sp_stylist_insert');
      await client.query('RELEASE SAVEPOINT sp_stylist_insert');

      await client.query('SAVEPOINT sp_stylist_update');
      await assert.rejects(
        () => client.query(`UPDATE stylists SET active = FALSE WHERE id = $1`, [stylistId]),
        /row-level security policy for table "stylists"/
      );
      await client.query('ROLLBACK TO SAVEPOINT sp_stylist_update');
      await client.query('RELEASE SAVEPOINT sp_stylist_update');

      // 2c) Unauthorized booking status transitions under PUBLIC_FLOW must be rejected by guard_bookings_public_update()
      for (const badStatus of ['IN_CHAIR', 'COMPLETED', 'NO_SHOW']) {
        await client.query('SAVEPOINT sp_bad_status');
        await assert.rejects(
          () =>
            client.query(`UPDATE bookings SET status = $1 WHERE id = $2`, [badStatus, bookingId]),
          /PUBLIC_FLOW status transition CONFIRMED ->/
        );
        await client.query('ROLLBACK TO SAVEPOINT sp_bad_status');
        await client.query('RELEASE SAVEPOINT sp_bad_status');
      }

      // CANCELED combined with time/stylist mutation must be rejected
      await client.query('SAVEPOINT sp_cancel_mut');
      await assert.rejects(
        () =>
          client.query(
            `UPDATE bookings
             SET status = 'CANCELED', starts_at = '2026-12-10T09:00:00.000Z'
             WHERE id = $1`,
            [bookingId]
          ),
        /PUBLIC_FLOW cancellation may not alter stylist_id or booking time/
      );
      await client.query('ROLLBACK TO SAVEPOINT sp_cancel_mut');
      await client.query('RELEASE SAVEPOINT sp_cancel_mut');

      // 3) Authorized PUBLIC_FLOW time reschedule (leaving usage_counted untouched) still succeeds
      await client.query('SAVEPOINT sp_reschedule');
      await client.query(
        `UPDATE bookings
         SET starts_at = '2026-12-10T08:00:00.000Z', ends_at = '2026-12-10T08:30:00.000Z'
         WHERE id = $1`,
        [bookingId]
      );
      await client.query('RELEASE SAVEPOINT sp_reschedule');

      // 4) Controlled SECURITY DEFINER RPC marks usage_counted = TRUE cleanly under PUBLIC_FLOW
      const incRes = await client.query<{ billable: number }>(
        `SELECT increment_salon_monthly_booking_usage($1, $2, '2026-12') AS billable`,
        [salonId, bookingId]
      );
      assert.equal(incRes.rows[0].billable, 1);

      const checkBk = await client.query<{ usage_counted: boolean }>(
        `SELECT usage_counted FROM bookings WHERE id = $1`,
        [bookingId]
      );
      assert.equal(checkBk.rows[0].usage_counted, true);

      // 5) Authorized PUBLIC_FLOW cancellation (without slot/stylist mutation) succeeds, then terminal status rejects further updates
      await client.query(`UPDATE bookings SET status = 'CANCELED' WHERE id = $1`, [bookingId]);
      await client.query('SAVEPOINT sp_terminal_reopen');
      let terminalBlockedByTrigger = false;
      let reopenRowCount = 0;
      try {
        const reopenRes = await client.query(
          `UPDATE bookings SET status = 'CONFIRMED' WHERE id = $1`,
          [bookingId]
        );
        reopenRowCount = reopenRes.rowCount ?? 0;
      } catch (err: unknown) {
        assert.match(
          err instanceof Error ? err.message : String(err),
          /PUBLIC_FLOW cannot modify booking from terminal status CANCELED/
        );
        terminalBlockedByTrigger = true;
        await client.query('ROLLBACK TO SAVEPOINT sp_terminal_reopen');
      }
      if (!terminalBlockedByTrigger) {
        assert.equal(
          reopenRowCount,
          0,
          'RLS must block PUBLIC_FLOW updates to terminal CANCELED bookings'
        );
      }
      await client.query('RELEASE SAVEPOINT sp_terminal_reopen');
      const afterTerminalCheck = await client.query<{ status: string }>(
        `SELECT status FROM bookings WHERE id = $1`,
        [bookingId]
      );
      assert.equal(afterTerminalCheck.rows[0]?.status, 'CANCELED');

      // Roll back entire synthetic test transaction
      await client.query('ROLLBACK');
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
      await pool.end();
    }
  }
);

test(
  'PG Integration 3: recordBookingInPostgres succeeds under quota and rolls back atomically on SQLSTATE P0002',
  { skip: SKIP_REASON },
  async () => {
    const pool = makePool(DB_TARGET!);
    const suffix = crypto.randomBytes(4).toString('hex');
    const salonId = `it-quota-${suffix}`;
    const publicCode = `wc_itq_${suffix}`;

    const seedClient = await pool.connect();
    try {
      await seedClient.query('BEGIN');
      await seedClient.query(
        `SELECT set_config('app.current_user_role', 'FOUNDER', true),
                set_config('app.current_user_id', 'it-founder', true)`
      );
      await seedClient.query(
        `INSERT INTO salons (
           id, public_code, salon_name, owner_name, whatsapp_phone, owner_auth_phone, public_contact_phone,
           package_tier, plan_tier, billing_status, monthly_booking_limit, grace_overage_limit
         )
         VALUES ($1, $2, 'Quota Integration Salon', 'Quota Integration Owner', '+923000000201', '+923000000201', '+923000000201',
                 'STARTER', 'STARTER', 'ACTIVE', 1, 0)`,
        [salonId, publicCode]
      );
      await seedClient.query(
        `INSERT INTO stylists (salon_id, name, active) VALUES ($1, 'Quota Barber', TRUE)`,
        [salonId]
      );
      await seedClient.query('COMMIT');
    } finally {
      seedClient.release();
    }

    setPgPoolOverrideForTests(pool);
    try {
      // 0) Unknown stylist under PUBLIC_FLOW fails closed without inserting stylists or bookings
      const unknownStylistRes = await recordBookingInPostgres({
        salonPublicCode: publicCode,
        bookingRef: `BK-IT-UNK-${suffix}`,
        clientName: 'Unknown Stylist Client',
        clientPhoneE164: '+923001119001',
        preferredLang: 'en',
        stylistName: 'Ghost Barber',
        servicesSnapshot: [{ name: 'Haircut', price: 1000, durationMins: 30 }],
        totalPrice: 1000,
        totalDurationMins: 30,
        startsAtIso: '2026-12-11T06:00:00.000Z',
        endsAtIso: '2026-12-11T06:30:00.000Z',
        source: 'WEB_LINK',
        idempotencyKey: `idem-it-unk-${suffix}`,
        proofHash: `proof-it-unk-${suffix}`,
        billingMonth: '2026-12',
        monthlyLimit: 1,
        accessTokenHash: crypto.createHash('sha256').update(`tok-unk-${suffix}`).digest('hex'),
        accessTokenExpiresAtIso: '2026-12-18T06:30:00.000Z',
      });
      assert.equal(unknownStylistRes.ok, false);
      if (!unknownStylistRes.ok) {
        assert.equal(unknownStylistRes.code, 'OVERLAP');
      }

      // 1) First booking within quota (1 of 1) succeeds and marks usage_counted = TRUE
      const firstRes = await recordBookingInPostgres({
        salonPublicCode: publicCode,
        bookingRef: `BK-IT-OK-${suffix}`,
        clientName: 'First Quota Client',
        clientPhoneE164: '+923001119001',
        preferredLang: 'en',
        stylistName: 'Quota Barber',
        servicesSnapshot: [{ name: 'Haircut', price: 1000, durationMins: 30 }],
        totalPrice: 1000,
        totalDurationMins: 30,
        startsAtIso: '2026-12-11T07:00:00.000Z',
        endsAtIso: '2026-12-11T07:30:00.000Z',
        source: 'WEB_LINK',
        idempotencyKey: `idem-it-ok-${suffix}`,
        proofHash: `proof-it-ok-${suffix}`,
        billingMonth: '2026-12',
        monthlyLimit: 1,
        accessTokenHash: crypto.createHash('sha256').update(`tok-ok-${suffix}`).digest('hex'),
        accessTokenExpiresAtIso: '2026-12-18T07:30:00.000Z',
      });
      assert.equal(firstRes.ok, true);

      // 2) Second booking exceeds quota (limit=1, grace=0) -> triggers P0002 & full rollback
      const secondRes = await recordBookingInPostgres({
        salonPublicCode: publicCode,
        bookingRef: `BK-IT-OVER-${suffix}`,
        clientName: 'Over Quota Client',
        clientPhoneE164: '+923001119002',
        preferredLang: 'en',
        stylistName: 'Quota Barber',
        servicesSnapshot: [{ name: 'Haircut', price: 1000, durationMins: 30 }],
        totalPrice: 1000,
        totalDurationMins: 30,
        startsAtIso: '2026-12-11T08:00:00.000Z',
        endsAtIso: '2026-12-11T08:30:00.000Z',
        source: 'WEB_LINK',
        idempotencyKey: `idem-it-over-${suffix}`,
        proofHash: `proof-it-over-${suffix}`,
        billingMonth: '2026-12',
        monthlyLimit: 1,
        accessTokenHash: crypto.createHash('sha256').update(`tok-over-${suffix}`).digest('hex'),
        accessTokenExpiresAtIso: '2026-12-18T08:30:00.000Z',
      });
      assert.equal(secondRes.ok, false);
      if (!secondRes.ok) {
        assert.equal(secondRes.code, 'DB_UNAVAILABLE');
        assert.match(secondRes.error, /monthly online booking capacity/i);
      }

      // 3) Verify PostgreSQL state contains ONLY the first booking & usage=1 (second booking + client + token rolled back)
      const verifyClient = await pool.connect();
      try {
        await verifyClient.query('BEGIN');
        await verifyClient.query(
          `SELECT set_config('app.current_user_role', 'FOUNDER', true),
                  set_config('app.current_user_id', 'it-founder', true)`
        );
        const bkRows = await verifyClient.query<{ booking_ref: string; usage_counted: boolean }>(
          `SELECT booking_ref, usage_counted FROM bookings WHERE salon_id = $1`,
          [salonId]
        );
        assert.equal(bkRows.rows.length, 1);
        assert.equal(bkRows.rows[0].booking_ref, `BK-IT-OK-${suffix}`);
        assert.equal(bkRows.rows[0].usage_counted, true);

        const cliRows = await verifyClient.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM clients WHERE salon_id = $1`,
          [salonId]
        );
        assert.equal(cliRows.rows[0].count, '1');

        const styRows = await verifyClient.query<{ name: string }>(
          `SELECT name FROM stylists WHERE salon_id = $1`,
          [salonId]
        );
        assert.deepEqual(
          styRows.rows.map((r) => r.name),
          ['Quota Barber']
        );

        const usageRows = await verifyClient.query<{ billable_bookings: number }>(
          `SELECT billable_bookings FROM salon_usage_monthly WHERE salon_id = $1 AND billing_month = '2026-12'`,
          [salonId]
        );
        assert.equal(usageRows.rows[0].billable_bookings, 1);
        await verifyClient.query('COMMIT');
      } finally {
        verifyClient.release();
      }
    } finally {
      setPgPoolOverrideForTests(null);
      const cleanupClient = await pool.connect();
      try {
        await cleanupClient.query('BEGIN');
        await cleanupClient.query(
          `SELECT set_config('app.current_user_role', 'FOUNDER', true),
                  set_config('app.current_user_id', 'it-founder', true)`
        );
        await cleanupClient.query(`DELETE FROM salons WHERE id = $1`, [salonId]);
        await cleanupClient.query('COMMIT');
      } finally {
        cleanupClient.release();
      }
      await pool.end();
    }
  }
);
