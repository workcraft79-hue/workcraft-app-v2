-- =============================================================================
-- WORKCRAFT Local — Safe Rollback for Migration 003
-- Drops ONLY tables, policies, constraints, and columns introduced by 003.
-- Never drops any 001_production_rls.sql base tables or existing customer rows.
-- =============================================================================

BEGIN;

-- Drop 003-only tables in dependency order
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

-- Restore 001 trigger definition on salons
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

-- Remove 003-added public policies on 001 tables
DROP POLICY IF EXISTS salons_public_lookup ON salons;
DROP POLICY IF EXISTS clients_public_flow_scoped ON clients;
DROP POLICY IF EXISTS services_public_flow_select ON services;

-- Restore original 001 constraints
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
ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_package_tier_check;
ALTER TABLE salons
  ADD CONSTRAINT salons_package_tier_check
  CHECK (package_tier IN ('STARTER', 'PRO', 'PRO++'));

COMMIT;
