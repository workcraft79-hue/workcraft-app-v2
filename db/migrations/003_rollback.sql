-- =============================================================================
-- WORKCRAFT Local — Safe, Non-Destructive Rollback for Migration 003
-- Reverses ONLY changes introduced by 003_reconcile_authoritative_schema.sql
-- relative to the pre-003 state (001_production_rls.sql + 002_web_first_production.sql).
--
-- Safety guarantees:
--   * NEVER drops any table created by 001 or 002 (preserves all 9 001 tables,
--     users, and all 13 002 tables: salon_memberships, auth_challenges, stylists,
--     service_stylists, stylist_leaves, client_browser_tokens, marketing_consents,
--     deals, bookings, booking_audit_log, booking_access_tokens,
--     salon_usage_monthly, reviews_log).
--   * Drops ONLY the 12 tables created exclusively by 003, using RESTRICT (no CASCADE).
--   * Preserves all 002 *_tenant_isolation policies, 002 constraints/FKs, and
--     002 columns.
--   * Note: Unreconcilable pre-003 ambiguities (e.g., salons.timezone_offset_hours
--     INTEGER in 001 vs NUMERIC(4,2) in 002; in-place DML backfills in 003)
--     cannot be restored without a pre-003 backup and are left non-destructively.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Drop 003-added RLS policies on pre-existing 001 and 002 tables
--    (Executed before dropping 003 GUC helper functions or 003-only columns)
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  tbl TEXT;
BEGIN
  IF to_regclass('public.salons') IS NOT NULL THEN
    DROP POLICY IF EXISTS salons_public_lookup ON salons;
  END IF;

  IF to_regclass('public.clients') IS NOT NULL THEN
    DROP POLICY IF EXISTS clients_public_flow_select ON clients;
    DROP POLICY IF EXISTS clients_public_flow_insert ON clients;
    DROP POLICY IF EXISTS clients_public_flow_update ON clients;
    DROP POLICY IF EXISTS clients_public_flow_scoped ON clients;
  END IF;

  IF to_regclass('public.services') IS NOT NULL THEN
    DROP POLICY IF EXISTS services_public_flow_select ON services;
  END IF;

  -- Dynamically generated policies added by 003 on pre-existing 002 tables
  -- (Preserves 002's *_tenant_isolation policies)
  FOR tbl IN
    SELECT unnest(ARRAY[
      'stylists', 'stylist_leaves', 'client_browser_tokens', 'marketing_consents',
      'deals', 'bookings', 'booking_audit_log', 'booking_access_tokens',
      'salon_usage_monthly', 'reviews_log', 'salon_memberships'
    ])
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_founder_all', tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_owner_isolated', tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_public_flow_scoped', tbl);
    END IF;
  END LOOP;

  IF to_regclass('public.stylists') IS NOT NULL THEN
    DROP POLICY IF EXISTS stylists_public_flow_select ON stylists;
    DROP POLICY IF EXISTS stylists_public_flow_insert ON stylists;
    DROP POLICY IF EXISTS stylists_public_flow_update ON stylists;
    DROP POLICY IF EXISTS stylists_agent_assigned ON stylists;
  END IF;

  IF to_regclass('public.stylist_leaves') IS NOT NULL THEN
    DROP POLICY IF EXISTS stylist_leaves_public_flow_select ON stylist_leaves;
  END IF;

  IF to_regclass('public.deals') IS NOT NULL THEN
    DROP POLICY IF EXISTS deals_public_flow_select ON deals;
  END IF;

  IF to_regclass('public.bookings') IS NOT NULL THEN
    DROP POLICY IF EXISTS bookings_public_flow_select ON bookings;
    DROP POLICY IF EXISTS bookings_public_flow_insert ON bookings;
    DROP POLICY IF EXISTS bookings_public_flow_update ON bookings;
  END IF;

  IF to_regclass('public.booking_audit_log') IS NOT NULL THEN
    DROP POLICY IF EXISTS booking_audit_log_public_flow_insert ON booking_audit_log;
  END IF;

  IF to_regclass('public.booking_access_tokens') IS NOT NULL THEN
    DROP POLICY IF EXISTS booking_access_tokens_public_flow_select ON booking_access_tokens;
    DROP POLICY IF EXISTS booking_access_tokens_public_flow_insert ON booking_access_tokens;
    DROP POLICY IF EXISTS booking_access_tokens_public_flow_update ON booking_access_tokens;
  END IF;

  IF to_regclass('public.salon_usage_monthly') IS NOT NULL THEN
    DROP POLICY IF EXISTS salon_usage_monthly_public_flow_select ON salon_usage_monthly;
    DROP POLICY IF EXISTS salon_usage_monthly_public_flow_insert ON salon_usage_monthly;
    DROP POLICY IF EXISTS salon_usage_monthly_public_flow_update ON salon_usage_monthly;
  END IF;

  IF to_regclass('public.service_stylists') IS NOT NULL THEN
    DROP POLICY IF EXISTS service_stylists_founder_all ON service_stylists;
    DROP POLICY IF EXISTS service_stylists_salon_scoped ON service_stylists;
    DROP POLICY IF EXISTS service_stylists_owner_isolated ON service_stylists;
    DROP POLICY IF EXISTS service_stylists_public_flow_select ON service_stylists;
  END IF;

  IF to_regclass('public.auth_challenges') IS NOT NULL THEN
    DROP POLICY IF EXISTS auth_challenges_founder_all ON auth_challenges;
    DROP POLICY IF EXISTS auth_challenges_self_select ON auth_challenges;
    DROP POLICY IF EXISTS auth_challenges_self_update ON auth_challenges;
    DROP POLICY IF EXISTS auth_challenges_public_client_insert ON auth_challenges;
    DROP POLICY IF EXISTS auth_challenges_public_client_select ON auth_challenges;
    DROP POLICY IF EXISTS auth_challenges_public_client_update ON auth_challenges;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Revert 003 RLS flags on pre-existing 002 tables
--    (Preserves ENABLE RLS on 002 tables where 002 enabled it, and ENABLE +
--     FORCE RLS on all 9 001 tables)
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'stylists', 'stylist_leaves', 'client_browser_tokens', 'marketing_consents',
      'deals', 'bookings', 'booking_audit_log', 'booking_access_tokens',
      'salon_usage_monthly', 'reviews_log'
    ])
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;

  FOR tbl IN
    SELECT unnest(ARRAY['salon_memberships', 'service_stylists', 'auth_challenges'])
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', tbl);
      EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Drop 003-only triggers & trigger functions, and restore 001 salons trigger
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.auth_challenges') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_guard_auth_challenges_update ON auth_challenges;
  END IF;

  IF to_regclass('public.booking_access_tokens') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_guard_booking_access_tokens_public_update ON booking_access_tokens;
  END IF;

  IF to_regclass('public.bookings') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_guard_bookings_public_update ON bookings;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.guard_auth_challenges_update() RESTRICT;
DROP FUNCTION IF EXISTS public.guard_booking_access_tokens_public_update() RESTRICT;
DROP FUNCTION IF EXISTS public.guard_bookings_public_update() RESTRICT;

-- Restore 001 BEFORE UPDATE trigger definition on salons before restoring 001 function body
-- (003 changed trg_guard_salon_billing_status to BEFORE INSERT OR UPDATE)
DO $$
BEGIN
  IF to_regclass('public.salons') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_guard_salon_billing_status ON salons;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.guard_salon_billing_status_update() RESTRICT;

CREATE FUNCTION guard_salon_billing_status_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.billing_status IS DISTINCT FROM OLD.billing_status
     AND current_workcraft_role() <> 'FOUNDER' THEN
    RAISE EXCEPTION 'Only FOUNDER or billing webhook may change billing_status';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.salons') IS NOT NULL THEN
    CREATE TRIGGER trg_guard_salon_billing_status
      BEFORE UPDATE ON salons
      FOR EACH ROW
      EXECUTE FUNCTION guard_salon_billing_status_update();
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Drop 003-only SECURITY DEFINER RPCs & GUC helpers; restore 001 GUC helpers
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_public_stylist_busy_blocks(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) RESTRICT;
DROP FUNCTION IF EXISTS public.upsert_public_booking_client(TEXT, TEXT, TEXT, TEXT, TEXT) RESTRICT;
DROP FUNCTION IF EXISTS public.increment_salon_monthly_booking_usage(TEXT, UUID, TEXT) RESTRICT;

DROP FUNCTION IF EXISTS public.current_workcraft_public_code() RESTRICT;
DROP FUNCTION IF EXISTS public.current_workcraft_challenge_id() RESTRICT;
DROP FUNCTION IF EXISTS public.current_workcraft_token_hash() RESTRICT;
DROP FUNCTION IF EXISTS public.current_workcraft_booking_id() RESTRICT;
DROP FUNCTION IF EXISTS public.current_workcraft_client_id() RESTRICT;
DROP FUNCTION IF EXISTS public.current_workcraft_idempotency_key() RESTRICT;

CREATE OR REPLACE FUNCTION current_workcraft_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_user_role', TRUE), ''),
    NULLIF((NULLIF(current_setting('request.jwt.claims', TRUE), '')::jsonb ->> 'user_role'), ''),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION current_workcraft_salon_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_salon_id', TRUE), ''),
    NULLIF((NULLIF(current_setting('request.jwt.claims', TRUE), '')::jsonb ->> 'salon_id'), ''),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION current_workcraft_agent_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_agent_id', TRUE), ''),
    NULLIF((NULLIF(current_setting('request.jwt.claims', TRUE), '')::jsonb ->> 'agent_id'), ''),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION current_workcraft_user_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_user_id', TRUE), ''),
    NULLIF((NULLIF(current_setting('request.jwt.claims', TRUE), '')::jsonb ->> 'sub'), ''),
    ''
  );
$$;

-- -----------------------------------------------------------------------------
-- 5. Drop ONLY the 12 tables created exclusively by Migration 003 (NO CASCADE)
--    Ordered so child table commission_ledger drops before payment_submissions.
--    ZERO 001 or 002 tables are dropped.
-- -----------------------------------------------------------------------------

DROP TABLE IF EXISTS audit_logs RESTRICT;
DROP TABLE IF EXISTS voice_threads RESTRICT;
DROP TABLE IF EXISTS founder_incidents RESTRICT;
DROP TABLE IF EXISTS counter_notifications RESTRICT;
DROP TABLE IF EXISTS commission_ledger RESTRICT;
DROP TABLE IF EXISTS cash_custody_ledger RESTRICT;
DROP TABLE IF EXISTS payment_submissions RESTRICT;
DROP TABLE IF EXISTS service_packages RESTRICT;
DROP TABLE IF EXISTS bridal_bookings RESTRICT;
DROP TABLE IF EXISTS walk_in_queue RESTRICT;
DROP TABLE IF EXISTS agent_profiles RESTRICT;
DROP TABLE IF EXISTS founder_biometrics RESTRICT;

-- -----------------------------------------------------------------------------
-- 6. Drop ONLY the 13 indexes created by Migration 003 on pre-existing 002 tables
-- -----------------------------------------------------------------------------

DROP INDEX IF EXISTS idx_bookings_salon_starts RESTRICT;
DROP INDEX IF EXISTS idx_bookings_salon_ref RESTRICT;
DROP INDEX IF EXISTS idx_bookings_stylist_starts RESTRICT;
DROP INDEX IF EXISTS idx_booking_audit_log_salon_created RESTRICT;
DROP INDEX IF EXISTS idx_booking_access_tokens_booking RESTRICT;
DROP INDEX IF EXISTS idx_stylists_salon RESTRICT;
DROP INDEX IF EXISTS idx_stylist_leaves_stylist RESTRICT;
DROP INDEX IF EXISTS idx_stylist_leaves_salon_window RESTRICT;
DROP INDEX IF EXISTS idx_deals_salon_active RESTRICT;
DROP INDEX IF EXISTS idx_auth_challenges_user_purpose RESTRICT;
DROP INDEX IF EXISTS idx_auth_challenges_expires RESTRICT;
DROP INDEX IF EXISTS idx_salon_memberships_salon RESTRICT;
DROP INDEX IF EXISTS idx_client_browser_tokens_salon_client RESTRICT;

-- -----------------------------------------------------------------------------
-- 7. Restore pre-003 columns, constraints & defaults on pre-existing tables
--    (Preserves all 002 columns, 002 FKs/uniques, and 001 base schemas)
-- -----------------------------------------------------------------------------

-- bookings (002 table): drop only 003-added usage_counted column
ALTER TABLE IF EXISTS bookings
  DROP COLUMN IF EXISTS usage_counted RESTRICT;

-- agent_invite_tokens (001 table): drop only 003-added columns
ALTER TABLE IF EXISTS agent_invite_tokens
  DROP COLUMN IF EXISTS permissions_json RESTRICT,
  DROP COLUMN IF EXISTS revoked_at RESTRICT,
  DROP COLUMN IF EXISTS created_by RESTRICT;

-- app_users (001 table): drop 003-added constraint and 003-added columns
ALTER TABLE IF EXISTS app_users
  DROP CONSTRAINT IF EXISTS app_users_session_version_check RESTRICT;

ALTER TABLE IF EXISTS app_users
  DROP COLUMN IF EXISTS auth_phone RESTRICT,
  DROP COLUMN IF EXISTS allowed_salon_ids RESTRICT,
  DROP COLUMN IF EXISTS session_version RESTRICT,
  DROP COLUMN IF EXISTS totp_secret_enc RESTRICT,
  DROP COLUMN IF EXISTS totp_enabled RESTRICT,
  DROP COLUMN IF EXISTS recovery_codes_hashes RESTRICT;

-- clients (001 + 002): drop only 003-only marketing columns; preserve 002 FKs & uniques;
-- restore pre-003 4-language CHECK constraints conditionally where columns exist
ALTER TABLE IF EXISTS clients
  DROP COLUMN IF EXISTS marketing_opted_in RESTRICT,
  DROP COLUMN IF EXISTS marketing_consent_source RESTRICT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'preferred_language'
  ) THEN
    ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_preferred_language_check RESTRICT;
    ALTER TABLE clients
      ADD CONSTRAINT clients_preferred_language_check
      CHECK (preferred_language IN ('en', 'roman_ur', 'ur', 'ar'));
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'preferred_lang'
  ) THEN
    ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_preferred_lang_check RESTRICT;
    ALTER TABLE clients
      ADD CONSTRAINT clients_preferred_lang_check
      CHECK (preferred_lang IN ('en', 'roman_ur', 'ur', 'ar'));
  END IF;
END $$;

-- salons (001 + 002): drop only strictly 003-only columns; preserve 002 constraints/columns;
-- restore 001 package_tier default/check (if column exists) and 002 plan_tier/default_lang checks
ALTER TABLE IF EXISTS salons
  DROP COLUMN IF EXISTS billing_cycle_start RESTRICT,
  DROP COLUMN IF EXISTS promo_video_url RESTRICT,
  DROP COLUMN IF EXISTS promo_video_expires_at RESTRICT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'salons' AND column_name = 'package_tier'
  ) THEN
    ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_package_tier_check RESTRICT;
    ALTER TABLE salons ALTER COLUMN package_tier SET DEFAULT 'PRO++';
    ALTER TABLE salons
      ADD CONSTRAINT salons_package_tier_check
      CHECK (package_tier IN ('STARTER', 'PRO', 'PRO++'));
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'salons' AND column_name = 'plan_tier'
  ) THEN
    ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_plan_tier_check RESTRICT;
    ALTER TABLE salons
      ADD CONSTRAINT salons_plan_tier_check
      CHECK (plan_tier IN ('STARTER', 'PRO', 'PRO++', 'CUSTOM'));
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'salons' AND column_name = 'default_lang'
  ) THEN
    ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_default_lang_check RESTRICT;
    ALTER TABLE salons
      ADD CONSTRAINT salons_default_lang_check
      CHECK (default_lang IN ('en', 'roman_ur', 'ur', 'ar'));
  END IF;
END $$;

COMMIT;
