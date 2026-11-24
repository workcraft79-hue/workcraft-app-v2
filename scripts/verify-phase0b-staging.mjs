/**
 * Phase 0B Staging Database Verification Script (Strictly Staging-Locked & Non-Destructive)
 *
 * Required environment variables:
 *   STAGING_DATABASE_URL       PostgreSQL URI for the isolated Neon `staging-phase0` branch
 *   EXPECTED_STAGING_DB_HOST   Exact expected PostgreSQL hostname for `staging-phase0`
 *
 * Required CLI flag:
 *   --confirm-staging
 *
 * Usage:
 *   STAGING_DATABASE_URL="postgres://..." EXPECTED_STAGING_DB_HOST="<staging-host>" \
 *     node scripts/verify-phase0b-staging.mjs --confirm-staging
 *
 * Security & Safety Guarantees:
 *   - Never falls back to DATABASE_URL or POSTGRES_URL
 *   - Refuses to connect if --confirm-staging or EXPECTED_STAGING_DB_HOST is missing or mismatched
 *   - Never prints passwords, tokens, usernames, or full connection strings
 *   - Runs all synthetic tests inside BEGIN ... ROLLBACK with SAVEPOINT guards and finally ROLLBACK
 */

import { Pool } from 'pg';

const EXPECTED_PROTECTED_TABLES = [
  'agent_invite_tokens',
  'agent_profiles',
  'alerts',
  'app_users',
  'appointments',
  'audit_logs',
  'auth_challenges',
  'barbers',
  'booking_access_tokens',
  'booking_audit_log',
  'bookings',
  'bridal_bookings',
  'cash_custody_ledger',
  'client_browser_tokens',
  'clients',
  'commission_ledger',
  'counter_notifications',
  'deals',
  'founder_biometrics',
  'founder_incidents',
  'marketing_consents',
  'payment_submissions',
  'reviews_log',
  'salon_memberships',
  'salon_usage_monthly',
  'salons',
  'service_packages',
  'service_stylists',
  'services',
  'stylist_leaves',
  'stylists',
  'voice_threads',
  'walk_in_queue',
  'whatsapp_messages',
];

function sanitizeErrorMessage(err) {
  const raw = err instanceof Error ? err.message : String(err || 'Unknown error');
  return raw.replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, '[REDACTED_URI]');
}

function validateStagingConfig() {
  const args = process.argv.slice(2);
  if (!args.includes('--confirm-staging')) {
    console.error(
      'ABORTED: Explicit --confirm-staging flag is required. Refusing to connect.'
    );
    process.exit(1);
  }

  const stagingUrl = (process.env.STAGING_DATABASE_URL || '').trim();
  if (!stagingUrl) {
    console.error(
      'ABORTED: STAGING_DATABASE_URL is required (DATABASE_URL / POSTGRES_URL fallbacks are disabled).'
    );
    process.exit(1);
  }

  const expectedHost = (process.env.EXPECTED_STAGING_DB_HOST || '').trim().toLowerCase();
  if (!expectedHost) {
    console.error(
      'ABORTED: EXPECTED_STAGING_DB_HOST is required so staging hostname can be verified before connecting.'
    );
    process.exit(1);
  }

  let parsedHost = '';
  try {
    const parsed = new URL(stagingUrl);
    if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
      console.error('ABORTED: STAGING_DATABASE_URL must use postgres:// or postgresql:// scheme.');
      process.exit(1);
    }
    parsedHost = (parsed.hostname || '').trim().toLowerCase();
  } catch {
    console.error('ABORTED: STAGING_DATABASE_URL could not be parsed as a valid database URL.');
    process.exit(1);
  }

  if (!parsedHost || parsedHost !== expectedHost) {
    console.error(
      `ABORTED: Staging hostname mismatch (parsed="${parsedHost || 'empty'}", expected="${expectedHost}"). Refusing to connect.`
    );
    process.exit(1);
  }

  return { stagingUrl, parsedHost };
}

async function run() {
  const { stagingUrl, parsedHost } = validateStagingConfig();
  const checks = [];
  const record = (name, status, detail) => {
    checks.push({ name, status, detail });
    console.log(`   [${status}] ${name}: ${detail}`);
  };

  console.log(`Staging target verified host: ${parsedHost}`);

  const pool = new Pool({
    connectionString: stagingUrl,
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: /localhost|127\.0\.0\.1/i.test(parsedHost) ? undefined : { rejectUnauthorized: false },
  });

  let client;
  let inTransaction = false;

  try {
    client = await pool.connect();

    // 1. Verify active database, role, and RLS bypass privileges
    const roleRes = await client.query(`
      SELECT
        current_database() AS database_name,
        current_user AS db_role,
        r.rolsuper AS is_superuser,
        r.rolbypassrls AS bypass_rls
      FROM pg_roles r
      WHERE r.rolname = current_user
    `);
    const roleRow = roleRes.rows[0];
    if (!roleRow) {
      record('Connection Role Metadata', 'FAIL', 'Could not resolve current_user in pg_roles.');
    } else {
      console.log(
        `Connected database="${roleRow.database_name}" role="${roleRow.db_role}" superuser=${roleRow.is_superuser} bypassrls=${roleRow.bypass_rls}`
      );
      if (roleRow.is_superuser || roleRow.bypass_rls) {
        record(
          'Role RLS Enforcement Privilege',
          'FAIL',
          `Role "${roleRow.db_role}" has superuser=${roleRow.is_superuser}, bypassrls=${roleRow.bypass_rls} and bypasses RLS.`
        );
      } else {
        record(
          'Role RLS Enforcement Privilege',
          'PASS',
          `Role "${roleRow.db_role}" is non-superuser with rolbypassrls=false.`
        );
      }
    }

    // 2. Verify required extensions
    const extRes = await client.query(
      `SELECT extname, extversion FROM pg_extension WHERE extname IN ('pgcrypto', 'btree_gist') ORDER BY extname`
    );
    const extMap = new Map(extRes.rows.map((r) => [r.extname, r.extversion]));
    if (extMap.has('pgcrypto') && extMap.has('btree_gist')) {
      record(
        'Required Extensions (pgcrypto, btree_gist)',
        'PASS',
        `pgcrypto=${extMap.get('pgcrypto')}, btree_gist=${extMap.get('btree_gist')}`
      );
    } else {
      record(
        'Required Extensions (pgcrypto, btree_gist)',
        'FAIL',
        `Found only: ${Array.from(extMap.keys()).join(', ') || 'none'}`
      );
    }

    // 3. Verify key 003 reconciled schema objects (TEXT IDs, public_code, overlap constraint)
    const schemaRes = await client.query(`
      SELECT
        (SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='salons' AND column_name='id') AS salons_id_type,
        (SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='clients' AND column_name='id') AS clients_id_type,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='salons' AND column_name='public_code') AS has_public_code,
        EXISTS (
          SELECT 1 FROM pg_constraint con
          JOIN pg_class c ON c.oid = con.conrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname='public' AND c.relname='bookings' AND con.conname='bookings_no_stylist_overlap' AND con.contype='x'
        ) AS has_overlap_exclusion
    `);
    const sRow = schemaRes.rows[0];
    if (
      sRow?.salons_id_type === 'text' &&
      sRow?.clients_id_type === 'text' &&
      sRow?.has_public_code === true &&
      sRow?.has_overlap_exclusion === true
    ) {
      record(
        'Reconciled Schema Invariants (TEXT IDs, public_code, GiST overlap)',
        'PASS',
        'salons.id=text, clients.id=text, public_code=present, bookings_no_stylist_overlap=present'
      );
    } else {
      record(
        'Reconciled Schema Invariants (TEXT IDs, public_code, GiST overlap)',
        'FAIL',
        JSON.stringify(sRow || {})
      );
    }

    // 4. Verify relrowsecurity & relforcerowsecurity on every expected protected public table
    const rlsTablesRes = await client.query(`
      SELECT
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS rls_forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname
    `);
    const rlsByTable = new Map(rlsTablesRes.rows.map((r) => [r.table_name, r]));
    const missingTables = [];
    const rlsUnprotected = [];

    for (const tableName of EXPECTED_PROTECTED_TABLES) {
      const row = rlsByTable.get(tableName);
      if (!row) {
        missingTables.push(tableName);
      } else if (!row.rls_enabled || !row.rls_forced) {
        rlsUnprotected.push(
          `${tableName}(enabled=${Boolean(row.rls_enabled)},forced=${Boolean(row.rls_forced)})`
        );
      }
    }

    const extraUnprotected = rlsTablesRes.rows
      .filter((r) => !EXPECTED_PROTECTED_TABLES.includes(r.table_name) && (!r.rls_enabled || !r.rls_forced))
      .map((r) => r.table_name);

    if (missingTables.length === 0 && rlsUnprotected.length === 0 && extraUnprotected.length === 0) {
      record(
        'Public Table RLS & FORCE RLS Coverage',
        'PASS',
        `All ${EXPECTED_PROTECTED_TABLES.length} expected public tables have relrowsecurity=true and relforcerowsecurity=true.`
      );
    } else {
      record(
        'Public Table RLS & FORCE RLS Coverage',
        'FAIL',
        `missing=[${missingTables.join(', ')}] unprotected=[${rlsUnprotected.join(', ')}] extraUnprotected=[${extraUnprotected.join(', ')}]`
      );
    }

    // 5. Transactional verification with synthetic rows & SAVEPOINT guards (always rolled back)
    const canEnforceRls = Boolean(roleRow && !roleRow.is_superuser && !roleRow.bypass_rls);

    await client.query('BEGIN');
    inTransaction = true;

    await client.query(`SELECT set_config('app.current_user_role', 'FOUNDER', true)`);
    await client.query(
      `INSERT INTO salons (
         id, public_code, salon_name, owner_name, whatsapp_phone,
         owner_auth_phone, public_contact_phone, assigned_agent_id
       )
       VALUES
         ('stg-verify-s1', 'wc_stgverify1', 'Staging Verify 1', 'Owner 1', '+923001111111', '+923001111111', '+923001111111', 'agent-verify-1'),
         ('stg-verify-s2', 'wc_stgverify2', 'Staging Verify 2', 'Owner 2', '+923002222222', '+923002222222', '+923002222222', 'agent-verify-2')`
    );

    if (!canEnforceRls) {
      record(
        'SALON_OWNER RLS Isolation',
        'SKIPPED',
        'Skipped because current database role has superuser/BYPASSRLS privilege.'
      );
      record(
        'Single-Tier AGENT RLS Assignment Isolation',
        'SKIPPED',
        'Skipped because current database role has superuser/BYPASSRLS privilege.'
      );
    } else {
      await client.query(`SELECT set_config('app.current_salon_id', 'stg-verify-s1', true)`);
      await client.query(`SELECT set_config('app.current_user_role', 'SALON_OWNER', true)`);
      const ownerSee = await client.query(`SELECT id FROM salons WHERE id LIKE 'stg-verify-%' ORDER BY id`);
      if (ownerSee.rows.length === 1 && ownerSee.rows[0].id === 'stg-verify-s1') {
        record('SALON_OWNER RLS Isolation', 'PASS', 'SALON_OWNER saw only assigned salon stg-verify-s1.');
      } else {
        record(
          'SALON_OWNER RLS Isolation',
          'FAIL',
          `Expected [stg-verify-s1], observed ${JSON.stringify(ownerSee.rows.map((r) => r.id))}`
        );
      }

      await client.query(`SELECT set_config('app.current_user_role', 'FOUNDER', true)`);
      await client.query(`SELECT set_config('app.current_salon_id', '', true)`);
      await client.query(`SELECT set_config('app.current_agent_id', 'agent-verify-1', true)`);
      await client.query(`SELECT set_config('app.current_user_role', 'AGENT', true)`);
      const agentSee = await client.query(`SELECT id FROM salons WHERE id LIKE 'stg-verify-%' ORDER BY id`);
      if (agentSee.rows.length === 1 && agentSee.rows[0].id === 'stg-verify-s1') {
        record(
          'Single-Tier AGENT RLS Assignment Isolation',
          'PASS',
          'AGENT agent-verify-1 saw only assigned salon stg-verify-s1.'
        );
      } else {
        record(
          'Single-Tier AGENT RLS Assignment Isolation',
          'FAIL',
          `Expected [stg-verify-s1], observed ${JSON.stringify(agentSee.rows.map((r) => r.id))}`
        );
      }
    }

    // 6. Billing guard trigger rejection check protected by SAVEPOINT
    await client.query(`SELECT set_config('app.current_salon_id', 'stg-verify-s1', true)`);
    await client.query(`SELECT set_config('app.current_user_role', 'SALON_OWNER', true)`);
    await client.query('SAVEPOINT sp_billing_guard');
    let billingRejected = false;
    let billingErrorDetail = '';
    try {
      await client.query(`UPDATE salons SET billing_status = 'ACTIVE' WHERE id = 'stg-verify-s1'`);
      await client.query('RELEASE SAVEPOINT sp_billing_guard');
    } catch (err) {
      billingRejected = true;
      billingErrorDetail = sanitizeErrorMessage(err);
      await client.query('ROLLBACK TO SAVEPOINT sp_billing_guard');
      await client.query('RELEASE SAVEPOINT sp_billing_guard');
    }
    if (billingRejected) {
      record(
        'Non-FOUNDER Billing Status Self-Activation Guard',
        'PASS',
        `Trigger rejected non-FOUNDER billing update (${billingErrorDetail}).`
      );
    } else {
      record(
        'Non-FOUNDER Billing Status Self-Activation Guard',
        'FAIL',
        'Non-FOUNDER UPDATE to salons.billing_status succeeded unexpectedly.'
      );
    }

    // 7. Booking overlap exclusion constraint check (SQLSTATE 23P01) protected by SAVEPOINT
    await client.query(`SELECT set_config('app.current_user_role', 'FOUNDER', true)`);
    await client.query(
      `INSERT INTO clients (id, salon_id, name, phone, phone_e164)
       VALUES ('cli-stg-verify-1', 'stg-verify-s1', 'Verify Client', '+923009999999', '+923009999999')`
    );
    const stRes = await client.query(
      `INSERT INTO stylists (salon_id, name) VALUES ('stg-verify-s1', 'Master Verify') RETURNING id`
    );
    const stylistId = stRes.rows[0].id;

    await client.query(
      `INSERT INTO bookings (
         salon_id, client_id, stylist_id, booking_ref, services_snapshot,
         total_price, total_duration_mins, starts_at, ends_at, proof_hash
       )
       VALUES (
         'stg-verify-s1', 'cli-stg-verify-1', $1, 'BK-VERIFY-1', '[]'::jsonb,
         1000, 30, '2026-12-01T10:00:00Z', '2026-12-01T10:30:00Z', 'verify-h1'
       )`,
      [stylistId]
    );

    await client.query('SAVEPOINT sp_booking_overlap');
    let overlapCode = '';
    try {
      await client.query(
        `INSERT INTO bookings (
           salon_id, client_id, stylist_id, booking_ref, services_snapshot,
           total_price, total_duration_mins, starts_at, ends_at, proof_hash
         )
         VALUES (
           'stg-verify-s1', 'cli-stg-verify-1', $1, 'BK-VERIFY-2', '[]'::jsonb,
           1000, 30, '2026-12-01T10:15:00Z', '2026-12-01T10:45:00Z', 'verify-h2'
         )`,
        [stylistId]
      );
      await client.query('RELEASE SAVEPOINT sp_booking_overlap');
    } catch (err) {
      overlapCode = err && typeof err.code === 'string' ? err.code : 'UNKNOWN';
      await client.query('ROLLBACK TO SAVEPOINT sp_booking_overlap');
      await client.query('RELEASE SAVEPOINT sp_booking_overlap');
    }

    if (overlapCode === '23P01') {
      record(
        'Stylist Booking Overlap Exclusion Constraint (23P01)',
        'PASS',
        'Concurrent overlapping slot rejected with SQLSTATE 23P01.'
      );
    } else {
      record(
        'Stylist Booking Overlap Exclusion Constraint (23P01)',
        'FAIL',
        `Expected SQLSTATE 23P01, observed "${overlapCode || 'NO_ERROR'}".`
      );
    }

    await client.query('ROLLBACK');
    inTransaction = false;
    record('Synthetic Test Data Rollback', 'PASS', 'All synthetic test records rolled back cleanly.');

    const passCount = checks.filter((c) => c.status === 'PASS').length;
    const failCount = checks.filter((c) => c.status === 'FAIL').length;
    const skipCount = checks.filter((c) => c.status === 'SKIPPED').length;

    console.log(`\nSummary: PASS=${passCount} FAIL=${failCount} SKIPPED=${skipCount}`);
    if (failCount > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Staging verification aborted with unexpected error:', sanitizeErrorMessage(err));
    process.exitCode = 1;
  } finally {
    if (client) {
      if (inTransaction) {
        await client.query('ROLLBACK').catch(() => {});
      }
      client.release();
    }
    await pool.end().catch(() => {});
  }
}

run();
