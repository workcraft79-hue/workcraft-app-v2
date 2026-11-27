-- =============================================================================
-- WORKCRAFT Local — Safe Rollback for Migration 003
-- Drops ONLY tables, policies, triggers, functions/RPCs, and constraints
-- introduced by 003_reconcile_authoritative_schema.sql, and restores 001
-- trigger/function/constraint/default definitions.
-- Never drops any 001_production_rls.sql base tables or existing customer rows.
-- =============================================================================

BEGIN;

-- 1. Drop 003-only tables in dependency order
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS voice_threads CASCADE;
DROP TABLE IF EXISTS founder_incidents CASCADE;
DROP TABLE IF EXISTS counter_notifications CASCADE;
DROP TABLE IF EXISTS commission_ledger CASCADE;
DROP TABLE IF EXISTS cash_custody_ledger CASCADE;
DROP TABLE IF EXISTS payment_submissions CASCADE;
DROP TABLE IF EXISTS service_packages CASCADE;
DROP TABLE IF EXISTS bridal_bookings CASCADE;
DROP TABLE IF EXISTS walk_in_queue CASCADE;
DROP TABLE IF EXISTS reviews_log CASCADE;
DROP TABLE IF EXISTS salon_usage_monthly CASCADE;
DROP TABLE IF EXISTS booking_access_tokens CASCADE;
DROP TABLE IF EXISTS booking_audit_log CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS deals CASCADE;
DROP TABLE IF EXISTS marketing_consents CASCADE;
DROP TABLE IF EXISTS client_browser_tokens CASCADE;
DROP TABLE IF EXISTS stylist_leaves CASCADE;
DROP TABLE IF EXISTS service_stylists CASCADE;
DROP TABLE IF EXISTS stylists CASCADE;
DROP TABLE IF EXISTS agent_profiles CASCADE;
DROP TABLE IF EXISTS founder_biometrics CASCADE;
DROP TABLE IF EXISTS auth_challenges CASCADE;
DROP TABLE IF EXISTS salon_memberships CASCADE;

-- 2. Drop 003-added trigger functions, SECURITY DEFINER RPCs, and 003 GUC helpers
DROP FUNCTION IF EXISTS public.guard_auth_challenges_update() CASCADE;
DROP FUNCTION IF EXISTS public.guard_booking_access_tokens_public_update() CASCADE;
DROP FUNCTION IF EXISTS public.guard_bookings_public_update() CASCADE;

DROP FUNCTION IF EXISTS public.get_public_stylist_busy_blocks(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.upsert_public_booking_client(TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.increment_salon_monthly_booking_usage(TEXT, UUID, TEXT);

DROP FUNCTION IF EXISTS public.current_workcraft_public_code();
DROP FUNCTION IF EXISTS public.current_workcraft_challenge_id();
DROP FUNCTION IF EXISTS public.current_workcraft_token_hash();
DROP FUNCTION IF EXISTS public.current_workcraft_booking_id();
DROP FUNCTION IF EXISTS public.current_workcraft_client_id();
DROP FUNCTION IF EXISTS public.current_workcraft_idempotency_key();

-- 3. Restore 001 GUC helper definitions
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

-- 4. Restore 001 trigger function & BEFORE UPDATE trigger definition on salons
--    (003 changed this trigger to BEFORE INSERT OR UPDATE; must revert to BEFORE UPDATE
--     before restoring the 001 function body that references OLD.billing_status)
DROP TRIGGER IF EXISTS trg_guard_salon_billing_status ON salons;

CREATE OR REPLACE FUNCTION guard_salon_billing_status_update()
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

CREATE TRIGGER trg_guard_salon_billing_status
  BEFORE UPDATE ON salons
  FOR EACH ROW
  EXECUTE FUNCTION guard_salon_billing_status_update();

-- 5. Remove 003-added public policies on 001 tables
DROP POLICY IF EXISTS salons_public_lookup ON salons;
DROP POLICY IF EXISTS clients_public_flow_select ON clients;
DROP POLICY IF EXISTS clients_public_flow_insert ON clients;
DROP POLICY IF EXISTS clients_public_flow_update ON clients;
DROP POLICY IF EXISTS clients_public_flow_scoped ON clients;
DROP POLICY IF EXISTS services_public_flow_select ON services;

-- 6. Drop 003-added constraints and restore original 001 constraints & defaults
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_session_version_check;

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_last_stylist_id_fkey;
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_salon_phone_e164_key;
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_preferred_lang_check;
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_preferred_language_check;
ALTER TABLE clients
  ADD CONSTRAINT clients_preferred_language_check
  CHECK (preferred_language IN ('en', 'roman_ur', 'ur', 'ar'));

ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_public_code_key;
ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_meta_phone_number_id_key;
ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_default_lang_check;
ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_salon_category_check;
ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_plan_tier_check;
ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_monthly_booking_limit_check;
ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_grace_overage_limit_check;
ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_package_tier_check;
ALTER TABLE salons
  ALTER COLUMN package_tier SET DEFAULT 'PRO++';
ALTER TABLE salons
  ADD CONSTRAINT salons_package_tier_check
  CHECK (package_tier IN ('STARTER', 'PRO', 'PRO++'));

COMMIT;
