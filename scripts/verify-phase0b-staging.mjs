/**
 * Phase 0B Staging Database Verification Script (Non-Destructive)
 *
 * Run against the Neon `staging-phase0` branch after executing
 * `db/migrations/003_reconcile_authoritative_schema.sql`:
 *
 *   STAGING_DATABASE_URL="postgres://..." node scripts/verify-phase0b-staging.mjs
 *
 * Runs synthetic checks inside a transaction that always executes ROLLBACK
 * so zero test rows are left behind in staging.
 */

import { Pool } from 'pg';

const url = (process.env.STAGING_DATABASE_URL || process.env.DATABASE_URL || '').trim();
if (!url) {
  console.error('Missing STAGING_DATABASE_URL (or DATABASE_URL). Refusing to guess.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  max: 2,
  ssl: /localhost|127\.0\.0\.1/i.test(url) ? undefined : { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('1. Checking extensions...');
    const ext = await client.query(`SELECT extname FROM pg_extension WHERE extname IN ('pgcrypto', 'btree_gist') ORDER BY extname`);
    console.log('   Extensions:', ext.rows.map((r) => r.extname).join(', '));

    console.log('2. Checking salons.id type and reconciled tables...');
    const col = await client.query(
      `SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='salons' AND column_name='id'`
    );
    console.log('   salons.id data_type:', col.rows[0]?.data_type);

    const tables = await client.query(
      `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
    );
    console.log('   Tables with RLS:', tables.rows.length);

    console.log('3. Testing RLS isolation, Founder-only billing guard, and 23P01 overlap inside ROLLBACK...');
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user_role', 'FOUNDER', true)`);

    await client.query(
      `INSERT INTO salons (id, public_code, salon_name, owner_name, whatsapp_phone, owner_auth_phone, public_contact_phone, assigned_agent_id)
       VALUES ('stg-s1', 'wc_stgs1', 'Staging 1', 'Owner 1', '+923001111111', '+923001111111', '+923001111111', 'agent-1'),
              ('stg-s2', 'wc_stgs2', 'Staging 2', 'Owner 2', '+923002222222', '+923002222222', '+923002222222', 'agent-2')`
    );

    await client.query(`SELECT set_config('app.current_salon_id', 'stg-s1', true)`);
    await client.query(`SELECT set_config('app.current_user_role', 'SALON_OWNER', true)`);
    const ownerSee = await client.query(`SELECT id FROM salons`);
    if (ownerSee.rows.length !== 1 || ownerSee.rows[0].id !== 'stg-s1') {
      throw new Error(`Expected SALON_OWNER to see only stg-s1, saw ${JSON.stringify(ownerSee.rows)}`);
    }
    console.log('   PASS: SALON_OWNER RLS tenant isolation verified.');

    let billingBlocked = false;
    try {
      await client.query(`UPDATE salons SET billing_status = 'ACTIVE' WHERE id = 'stg-s1'`);
    } catch {
      billingBlocked = true;
    }
    if (!billingBlocked) {
      throw new Error('Expected non-FOUNDER billing_status update to be blocked by trigger.');
    }
    console.log('   PASS: Non-FOUNDER billing_status self-activation blocked.');

    await client.query(`SELECT set_config('app.current_user_role', 'FOUNDER', true)`);
    await client.query(`SELECT set_config('app.current_agent_id', 'agent-1', true)`);
    await client.query(`SELECT set_config('app.current_user_role', 'AGENT', true)`);
    const agentSee = await client.query(`SELECT id FROM salons`);
    if (agentSee.rows.length !== 1 || agentSee.rows[0].id !== 'stg-s1') {
      throw new Error(`Expected AGENT agent-1 to see only stg-s1, saw ${JSON.stringify(agentSee.rows)}`);
    }
    console.log('   PASS: Single-tier AGENT RLS assignment isolation verified.');

    await client.query(`SELECT set_config('app.current_user_role', 'FOUNDER', true)`);
    await client.query(
      `INSERT INTO clients (id, salon_id, name, phone, phone_e164) VALUES ('cli-stg-1', 'stg-s1', 'Client 1', '+923009999999', '+923009999999')`
    );
    const st = await client.query(
      `INSERT INTO stylists (salon_id, name) VALUES ('stg-s1', 'Master Ali') RETURNING id`
    );
    const stylistId = st.rows[0].id;
    await client.query(
      `INSERT INTO bookings (salon_id, client_id, stylist_id, booking_ref, services_snapshot, total_price, total_duration_mins, starts_at, ends_at, proof_hash)
       VALUES ('stg-s1', 'cli-stg-1', $1, 'BK-1', '[]'::jsonb, 1000, 30, '2026-12-01T10:00:00Z', '2026-12-01T10:30:00Z', 'h1')`,
      [stylistId]
    );
    let overlapRejected = false;
    try {
      await client.query(
        `INSERT INTO bookings (salon_id, client_id, stylist_id, booking_ref, services_snapshot, total_price, total_duration_mins, starts_at, ends_at, proof_hash)
         VALUES ('stg-s1', 'cli-stg-1', $1, 'BK-2', '[]'::jsonb, 1000, 30, '2026-12-01T10:15:00Z', '2026-12-01T10:45:00Z', 'h2')`,
        [stylistId]
      );
    } catch (err) {
      if (err && err.code === '23P01') overlapRejected = true;
    }
    if (!overlapRejected) {
      throw new Error('Expected overlapping stylist booking to fail with SQLSTATE 23P01.');
    }
    console.log('   PASS: btree_gist overlap exclusion constraint returned SQLSTATE 23P01.');

    await client.query('ROLLBACK');
    console.log('All Phase 0B staging checks PASSED (rolled back cleanly).');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Staging verification failed:', err);
  process.exit(1);
});
