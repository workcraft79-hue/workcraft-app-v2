-- =============================================================================
-- WORKCRAFT Local — Authoritative Schema Reconciliation Migration
-- Migration: 003_reconcile_authoritative_schema.sql
--
-- Non-destructive reconciliation atop live 001_production_rls.sql:
--   * Preserves all 9 existing 001 tables and live TEXT primary keys (salons.id, clients.id)
--   * Installs btree_gist + pgcrypto for stylist overlap exclusion constraints
--   * Standardizes ALL RLS policies on current_workcraft_role() (app.current_user_role),
--     current_workcraft_salon_id(), current_workcraft_agent_id(), current_workcraft_user_id()
--   * Enforces single-tier individual agents (FOUNDER-governed; ZERO co-agent tables)
--   * Keeps agent commissions at 0% default and cash custody limits deferred
--   * Ensures payment_submissions require explicit FOUNDER approval before activation
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- -----------------------------------------------------------------------------
-- 1. Helper Role/Tenant Functions (Preserved & Hardened for SET LOCAL GUC)
-- -----------------------------------------------------------------------------

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
-- 2. Reconcile Existing 001 Tables Non-Destructively (TEXT salons.id preserved)
-- -----------------------------------------------------------------------------

ALTER TABLE salons
  ADD COLUMN IF NOT EXISTS public_code TEXT,
  ADD COLUMN IF NOT EXISTS salon_category TEXT NOT NULL DEFAULT 'MENS',
  ADD COLUMN IF NOT EXISTS owner_auth_phone TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS public_contact_phone TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS public_whatsapp_phone TEXT,
  ADD COLUMN IF NOT EXISTS timezone_iana TEXT NOT NULL DEFAULT 'Asia/Karachi',
  ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'PKR',
  ADD COLUMN IF NOT EXISTS default_lang TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS enabled_langs TEXT[] NOT NULL DEFAULT ARRAY['en', 'roman_ur', 'ur']::TEXT[],
  ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'PRO++',
  ADD COLUMN IF NOT EXISTS monthly_booking_limit INTEGER NOT NULL DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS grace_overage_limit INTEGER NOT NULL DEFAULT 150,
  ADD COLUMN IF NOT EXISTS billing_cycle_start DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS whatsapp_addon_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS meta_phone_number_id TEXT,
  ADD COLUMN IF NOT EXISTS operating_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS google_maps_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS promo_video_url TEXT,
  ADD COLUMN IF NOT EXISTS promo_video_expires_at TIMESTAMPTZ;

ALTER TABLE salons
  ALTER COLUMN timezone_offset_hours TYPE NUMERIC(4,2)
  USING timezone_offset_hours::NUMERIC(4,2);

ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_package_tier_check;
ALTER TABLE salons
  ADD CONSTRAINT salons_package_tier_check
  CHECK (package_tier IN ('STARTER', 'PRO', 'PRO++', 'GROWTH', 'VIP', 'CUSTOM'));

ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_plan_tier_check;
ALTER TABLE salons
  ADD CONSTRAINT salons_plan_tier_check
  CHECK (plan_tier IN ('STARTER', 'PRO', 'PRO++', 'GROWTH', 'VIP', 'CUSTOM'));

ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_salon_category_check;
ALTER TABLE salons
  ADD CONSTRAINT salons_salon_category_check
  CHECK (salon_category IN ('MENS', 'LADIES'));

ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_default_lang_check;
ALTER TABLE salons
  ADD CONSTRAINT salons_default_lang_check
  CHECK (default_lang IN ('en', 'roman_ur', 'ur', 'ar', 'it', 'ru', 'fr', 'de', 'es'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'salons_public_code_key'
  ) THEN
    ALTER TABLE salons ADD CONSTRAINT salons_public_code_key UNIQUE (public_code);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'salons_meta_phone_number_id_key'
  ) THEN
    ALTER TABLE salons ADD CONSTRAINT salons_meta_phone_number_id_key UNIQUE (meta_phone_number_id);
  END IF;
END $$;

-- Temporarily mark migration transaction as FOUNDER strictly for idempotent backfill, then clear
SELECT set_config('app.current_user_role', 'FOUNDER', true);

UPDATE salons
SET
  public_code = COALESCE(NULLIF(public_code, ''), 'wc_' || substring(encode(digest(id, 'sha256'), 'hex') from 1 for 16)),
  owner_auth_phone = CASE WHEN owner_auth_phone = '' THEN whatsapp_phone ELSE owner_auth_phone END,
  public_contact_phone = CASE WHEN public_contact_phone = '' THEN whatsapp_phone ELSE public_contact_phone END,
  currency_code = CASE WHEN currency_code = 'PKR' AND currency <> 'PKR' THEN currency ELSE currency_code END,
  plan_tier = CASE WHEN plan_tier <> package_tier THEN package_tier ELSE plan_tier END
WHERE public_code IS NULL OR public_code = '' OR owner_auth_phone = '' OR public_contact_phone = '' OR plan_tier <> package_tier;

SELECT set_config('app.current_user_role', '', true);

-- Reconcile app_users with TOTP, recovery codes, session version & multi-branch array
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS auth_phone TEXT,
  ADD COLUMN IF NOT EXISTS allowed_salon_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS totp_secret_enc TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recovery_codes_hashes JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Reconcile services
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS buffer_after_mins INTEGER NOT NULL DEFAULT 0 CHECK (buffer_after_mins BETWEEN 0 AND 120),
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE services SET active = is_active WHERE active IS DISTINCT FROM is_active;

-- Reconcile clients (keep id TEXT PK & existing columns, add Web-First columns)
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_preferred_language_check;
ALTER TABLE clients
  ADD CONSTRAINT clients_preferred_language_check
  CHECK (preferred_language IN ('en', 'roman_ur', 'ur', 'ar', 'it', 'ru', 'fr', 'de', 'es'));

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS phone_e164 TEXT,
  ADD COLUMN IF NOT EXISTS preferred_lang TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS birth_day_month TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS total_visits INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_service_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  ADD COLUMN IF NOT EXISTS last_stylist_id UUID,
  ADD COLUMN IF NOT EXISTS marketing_opted_in BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS marketing_consent_source TEXT NOT NULL DEFAULT 'WEB_BOOKING',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_preferred_lang_check;
ALTER TABLE clients
  ADD CONSTRAINT clients_preferred_lang_check
  CHECK (preferred_lang IN ('en', 'roman_ur', 'ur', 'ar', 'it', 'ru', 'fr', 'de', 'es'));

UPDATE clients
SET
  phone_e164 = COALESCE(NULLIF(phone_e164, ''), phone),
  preferred_lang = COALESCE(NULLIF(preferred_language, ''), preferred_lang, 'en'),
  birth_day_month = CASE WHEN birth_day_month = '' THEN birth_date ELSE birth_day_month END
WHERE phone_e164 IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_salon_phone_e164_key'
  ) THEN
    ALTER TABLE clients ADD CONSTRAINT clients_salon_phone_e164_key UNIQUE (salon_id, phone_e164);
  END IF;
END $$;

-- Reconcile agent_invite_tokens (Founder-issued single-use invites only)
ALTER TABLE agent_invite_tokens
  ADD COLUMN IF NOT EXISTS permissions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'FOUNDER';

-- -----------------------------------------------------------------------------
-- 3. Auth Memberships, Challenges, Biometrics & Single-Tier Agent Profiles
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS salon_memberships (
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'OWNER' CHECK (role IN ('OWNER', 'MANAGER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, salon_id)
);

CREATE TABLE IF NOT EXISTS auth_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  target_phone TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('OWNER_LOGIN', 'AGENT_LOGIN', 'CROSS_DEVICE_CLIENT')),
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS founder_biometrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id TEXT NOT NULL UNIQUE,
  spki_base64 TEXT NOT NULL,
  device_label TEXT NOT NULL DEFAULT 'Founder Device',
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Single-tier Field Agents only (directly governed by Founder; 0% default commission; ZERO sub/co-agents)
CREATE TABLE IF NOT EXISTS agent_profiles (
  agent_id TEXT PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES app_users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  territory TEXT NOT NULL DEFAULT '',
  country_name TEXT NOT NULL DEFAULT 'Pakistan',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DEACTIVATED')),
  commission_setup_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (commission_setup_pct >= 0 AND commission_setup_pct <= 100),
  commission_recurring_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (commission_recurring_pct >= 0 AND commission_recurring_pct <= 100),
  created_by TEXT NOT NULL DEFAULT 'FOUNDER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 4. Stylists, Eligibility, Leaves, Browser Tokens, Consents & Deals
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS stylists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  chair_label TEXT NOT NULL DEFAULT 'Chair 1',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (salon_id, name)
);

-- Non-destructive copy of any existing 001 barbers into stylists
INSERT INTO stylists (id, salon_id, name, chair_label, active, created_at)
SELECT b.id, b.salon_id, b.name, b.chair_label, b.is_active, b.created_at
FROM barbers b
ON CONFLICT (salon_id, name) DO NOTHING;

CREATE TABLE IF NOT EXISTS service_stylists (
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  stylist_id UUID NOT NULL REFERENCES stylists(id) ON DELETE CASCADE,
  PRIMARY KEY (service_id, stylist_id)
);

CREATE TABLE IF NOT EXISTS stylist_leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  stylist_id UUID NOT NULL REFERENCES stylists(id) ON DELETE CASCADE,
  lock_type TEXT NOT NULL DEFAULT 'CHAIR_LOCK' CHECK (lock_type IN ('CHAIR_LOCK', 'LEAVE', 'BREAK')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS client_browser_tokens (
  token_hash TEXT PRIMARY KEY,
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketing_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  opted_in BOOLEAN NOT NULL DEFAULT FALSE,
  consent_source TEXT NOT NULL DEFAULT 'WEB_BOOKING',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (salon_id, client_id)
);

CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  ad_channel TEXT NOT NULL DEFAULT 'DIRECT' CHECK (ad_channel IN ('FB', 'IG', 'TIKTOK', 'DIRECT')),
  discount_type TEXT NOT NULL DEFAULT 'PCT' CHECK (discount_type IN ('PCT', 'FIXED', 'BUNDLE_PRICE')),
  discount_value INTEGER NOT NULL DEFAULT 15 CHECK (discount_value >= 0),
  service_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  video_key TEXT,
  video_url TEXT,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 5. Transactional Bookings (btree_gist Overlap Guard), Tokens, Audit & Usage
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  stylist_id UUID NOT NULL REFERENCES stylists(id) ON DELETE RESTRICT,
  booking_ref TEXT NOT NULL,
  services_snapshot JSONB NOT NULL,
  total_price INTEGER NOT NULL CHECK (total_price >= 0),
  total_duration_mins INTEGER NOT NULL CHECK (total_duration_mins > 0),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  occupied_range TSTZRANGE GENERATED ALWAYS AS (tstzrange(starts_at, ends_at, '[)')) STORED,
  status TEXT NOT NULL DEFAULT 'CONFIRMED'
    CHECK (status IN ('CONFIRMED', 'IN_CHAIR', 'COMPLETED', 'CANCELED', 'NO_SHOW')),
  source TEXT NOT NULL DEFAULT 'QR'
    CHECK (source IN ('QR', 'WEB_LINK', 'FB_AD', 'IG_AD', 'TIKTOK_AD', 'OWNER_WALKIN', 'WHATSAPP_ADDON')),
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  idempotency_key TEXT,
  proof_hash TEXT NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at),
  UNIQUE (salon_id, idempotency_key),
  CONSTRAINT bookings_no_stylist_overlap EXCLUDE USING gist (
    stylist_id WITH =,
    occupied_range WITH &&
  ) WHERE (status IN ('CONFIRMED', 'IN_CHAIR'))
);

CREATE TABLE IF NOT EXISTS booking_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('CUSTOMER', 'OWNER', 'SYSTEM')),
  action TEXT NOT NULL CHECK (action IN ('CREATED', 'RESCHEDULED', 'CANCELED', 'IN_CHAIR', 'COMPLETED')),
  previous_state JSONB,
  new_state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salon_usage_monthly (
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  billing_month TEXT NOT NULL,
  billable_bookings INTEGER NOT NULL DEFAULT 0 CHECK (billable_bookings >= 0),
  overage_bookings INTEGER NOT NULL DEFAULT 0 CHECK (overage_bookings >= 0),
  limit_snapshot INTEGER NOT NULL,
  meta_messages_used INTEGER NOT NULL DEFAULT 0 CHECK (meta_messages_used >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (salon_id, billing_month)
);

CREATE TABLE IF NOT EXISTS reviews_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  review_url TEXT NOT NULL,
  invitation_shown_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clicked_at TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- 6. Operational Modules, Counter Notifications, Incidents & Founder Governance
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS walk_in_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL DEFAULT '',
  service_name TEXT NOT NULL DEFAULT 'Classic Service',
  preferred_stylist_id UUID REFERENCES stylists(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'IN_CHAIR', 'COMPLETED', 'LEFT')),
  queue_position INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bridal_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  event_date DATE NOT NULL,
  package_summary TEXT NOT NULL,
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  advance_paid INTEGER NOT NULL DEFAULT 0 CHECK (advance_paid >= 0),
  balance_settled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL DEFAULT '',
  package_title TEXT NOT NULL,
  total_sessions INTEGER NOT NULL CHECK (total_sessions > 0),
  used_sessions INTEGER NOT NULL DEFAULT 0 CHECK (used_sessions >= 0),
  price_paid INTEGER NOT NULL DEFAULT 0 CHECK (price_paid >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id TEXT REFERENCES salons(id) ON DELETE SET NULL,
  submitted_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  submitted_by_role TEXT NOT NULL CHECK (submitted_by_role IN ('FOUNDER', 'AGENT', 'SALON_OWNER')),
  agent_id TEXT,
  submission_kind TEXT NOT NULL CHECK (submission_kind IN ('ONBOARDING_SETUP', 'MAINT_PAYMENT', 'PACKAGE_UPGRADE', 'VIDEO_CAMPAIGN')),
  target_plan_tier TEXT,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'PKR',
  method TEXT NOT NULL,
  reference_tid TEXT NOT NULL UNIQUE,
  proof_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deferred cash custody & 0% default commission ledgers (reporting only; no limits enforced)
CREATE TABLE IF NOT EXISTS cash_custody_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  salon_id TEXT REFERENCES salons(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('CASH_COLLECTED', 'CASH_REMITTED')),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'PKR',
  reference_tid TEXT NOT NULL DEFAULT '',
  proof_hash TEXT NOT NULL DEFAULT '',
  recorded_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commission_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  salon_id TEXT REFERENCES salons(id) ON DELETE SET NULL,
  payment_submission_id UUID REFERENCES payment_submissions(id) ON DELETE SET NULL,
  commission_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (commission_pct >= 0),
  commission_amount INTEGER NOT NULL DEFAULT 0 CHECK (commission_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'PKR',
  status TEXT NOT NULL DEFAULT 'RECORDED_ZERO' CHECK (status IN ('RECORDED_ZERO', 'PENDING', 'PAID', 'VOID')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS counter_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('NEW_BOOKING', 'RESCHEDULED', 'CANCELED', 'WALKIN_ADDED')),
  title TEXT NOT NULL,
  speech_text TEXT NOT NULL DEFAULT '',
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS founder_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  area TEXT NOT NULL,
  route TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'CRITICAL')),
  message TEXT NOT NULL,
  stack_hint TEXT,
  resolution_status TEXT NOT NULL CHECK (resolution_status IN ('AUTO_RESOLVED', 'FALLBACK_ACTIVE', 'NEEDS_FOUNDER_ACTION', 'RESOLVED_BY_FOUNDER')),
  recovery_ms INTEGER NOT NULL DEFAULT 500,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS voice_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  source_lang TEXT NOT NULL DEFAULT 'en',
  transcript_text TEXT NOT NULL DEFAULT '',
  translated_text TEXT NOT NULL DEFAULT '',
  audio_key TEXT,
  read_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id TEXT,
  actor_role TEXT NOT NULL,
  salon_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_bookings_salon_starts ON bookings (salon_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_bookings_stylist_starts ON bookings (stylist_id, starts_at) WHERE status IN ('CONFIRMED', 'IN_CHAIR');
CREATE INDEX IF NOT EXISTS idx_booking_access_tokens_booking ON booking_access_tokens (booking_id);
CREATE INDEX IF NOT EXISTS idx_stylists_salon ON stylists (salon_id);
CREATE INDEX IF NOT EXISTS idx_stylist_leaves_stylist ON stylist_leaves (stylist_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_deals_salon_active ON deals (salon_id, active, expires_at);
CREATE INDEX IF NOT EXISTS idx_counter_notifications_salon ON counter_notifications (salon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_status ON payment_submissions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);

-- -----------------------------------------------------------------------------
-- 7. Billing Status Trigger Guard (FOUNDER-Only Activation)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION guard_salon_billing_status_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.billing_status IS DISTINCT FROM OLD.billing_status
      OR NEW.package_tier IS DISTINCT FROM OLD.package_tier
      OR NEW.plan_tier IS DISTINCT FROM OLD.plan_tier
      OR NEW.monthly_booking_limit IS DISTINCT FROM OLD.monthly_booking_limit)
     AND current_workcraft_role() <> 'FOUNDER' THEN
    RAISE EXCEPTION 'Only FOUNDER may modify salon billing_status, tier, or monthly quotas';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_salon_billing_status ON salons;
CREATE TRIGGER trg_guard_salon_billing_status
  BEFORE UPDATE ON salons
  FOR EACH ROW
  EXECUTE FUNCTION guard_salon_billing_status_update();

-- -----------------------------------------------------------------------------
-- 8. Unified Row-Level Security (FORCE RLS + Explicit Public & Agent Scopes)
-- -----------------------------------------------------------------------------

-- Public storefront read/insert/update policies scoped strictly to current_workcraft_salon_id()
DROP POLICY IF EXISTS salons_public_lookup ON salons;
CREATE POLICY salons_public_lookup ON salons
  FOR SELECT
  USING (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND public_code IS NOT NULL
    AND billing_status <> 'SUSPENDED'
  );

DROP POLICY IF EXISTS clients_public_flow_scoped ON clients;
CREATE POLICY clients_public_flow_scoped ON clients
  FOR ALL
  USING (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND salon_id = current_workcraft_salon_id()
  )
  WITH CHECK (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND salon_id = current_workcraft_salon_id()
  );

DROP POLICY IF EXISTS services_public_flow_select ON services;
CREATE POLICY services_public_flow_select ON services
  FOR SELECT
  USING (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND salon_id = current_workcraft_salon_id()
  );

-- New tenant-scoped operational tables (Salon Owner & Founder, plus scoped Public/Agent policies)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'stylists', 'stylist_leaves', 'client_browser_tokens', 'marketing_consents',
      'deals', 'bookings', 'booking_audit_log', 'booking_access_tokens',
      'salon_usage_monthly', 'reviews_log', 'walk_in_queue', 'bridal_bookings',
      'service_packages', 'counter_notifications', 'voice_threads', 'salon_memberships'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_founder_all', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (current_workcraft_role() = ''FOUNDER'') WITH CHECK (current_workcraft_role() = ''FOUNDER'')',
      tbl || '_founder_all',
      tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_owner_isolated', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (current_workcraft_role() = ''SALON_OWNER'' AND salon_id = current_workcraft_salon_id()) WITH CHECK (current_workcraft_role() = ''SALON_OWNER'' AND salon_id = current_workcraft_salon_id())',
      tbl || '_owner_isolated',
      tbl
    );
  END LOOP;
END $$;

-- Public booking flow scoped policies (requires SET LOCAL app.current_salon_id to match resolved public_code)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'stylists', 'stylist_leaves', 'client_browser_tokens', 'marketing_consents',
      'deals', 'bookings', 'booking_audit_log', 'booking_access_tokens',
      'salon_usage_monthly', 'reviews_log', 'counter_notifications'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_public_flow_scoped', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (current_workcraft_role() = ''PUBLIC_FLOW'' AND salon_id = current_workcraft_salon_id()) WITH CHECK (current_workcraft_role() = ''PUBLIC_FLOW'' AND salon_id = current_workcraft_salon_id())',
      tbl || '_public_flow_scoped',
      tbl
    );
  END LOOP;
END $$;

-- Agent scoped access for stylists of assigned salons only
DROP POLICY IF EXISTS stylists_agent_assigned ON stylists;
CREATE POLICY stylists_agent_assigned ON stylists
  FOR ALL
  USING (
    current_workcraft_role() = 'AGENT'
    AND EXISTS (
      SELECT 1 FROM salons s
      WHERE s.id = stylists.salon_id
        AND s.assigned_agent_id = current_workcraft_agent_id()
    )
  )
  WITH CHECK (
    current_workcraft_role() = 'AGENT'
    AND EXISTS (
      SELECT 1 FROM salons s
      WHERE s.id = stylists.salon_id
        AND s.assigned_agent_id = current_workcraft_agent_id()
    )
  );

-- service_stylists (join table)
ALTER TABLE service_stylists ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_stylists FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_stylists_founder_all ON service_stylists;
CREATE POLICY service_stylists_founder_all ON service_stylists
  FOR ALL USING (current_workcraft_role() = 'FOUNDER') WITH CHECK (current_workcraft_role() = 'FOUNDER');
DROP POLICY IF EXISTS service_stylists_salon_scoped ON service_stylists;
CREATE POLICY service_stylists_salon_scoped ON service_stylists
  FOR ALL
  USING (
    current_workcraft_role() IN ('SALON_OWNER', 'PUBLIC_FLOW')
    AND EXISTS (
      SELECT 1 FROM stylists st
      WHERE st.id = service_stylists.stylist_id
        AND st.salon_id = current_workcraft_salon_id()
    )
  )
  WITH CHECK (
    current_workcraft_role() = 'SALON_OWNER'
    AND EXISTS (
      SELECT 1 FROM stylists st
      WHERE st.id = service_stylists.stylist_id
        AND st.salon_id = current_workcraft_salon_id()
    )
  );

-- auth_challenges (Founder & challenge self-service/auth flow)
ALTER TABLE auth_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_challenges FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auth_challenges_founder_all ON auth_challenges;
CREATE POLICY auth_challenges_founder_all ON auth_challenges
  FOR ALL USING (current_workcraft_role() IN ('FOUNDER', 'PUBLIC_FLOW'))
  WITH CHECK (current_workcraft_role() IN ('FOUNDER', 'PUBLIC_FLOW'));

-- founder_biometrics & founder_incidents & audit_logs (Founder strictly)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY['founder_biometrics', 'founder_incidents', 'audit_logs'])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_founder_all', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (current_workcraft_role() = ''FOUNDER'') WITH CHECK (current_workcraft_role() = ''FOUNDER'')',
      tbl || '_founder_all',
      tbl
    );
  END LOOP;
END $$;

-- agent_profiles (Founder manages; Agent reads own row only)
ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_profiles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_profiles_founder_all ON agent_profiles;
CREATE POLICY agent_profiles_founder_all ON agent_profiles
  FOR ALL USING (current_workcraft_role() = 'FOUNDER') WITH CHECK (current_workcraft_role() = 'FOUNDER');
DROP POLICY IF EXISTS agent_profiles_self_select ON agent_profiles;
CREATE POLICY agent_profiles_self_select ON agent_profiles
  FOR SELECT USING (current_workcraft_role() = 'AGENT' AND agent_id = current_workcraft_agent_id());

-- payment_submissions (Founder manages all; Agent reads/inserts own submissions; Owner reads/inserts own salon)
ALTER TABLE payment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_submissions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_submissions_founder_all ON payment_submissions;
CREATE POLICY payment_submissions_founder_all ON payment_submissions
  FOR ALL USING (current_workcraft_role() = 'FOUNDER') WITH CHECK (current_workcraft_role() = 'FOUNDER');
DROP POLICY IF EXISTS payment_submissions_agent_scoped ON payment_submissions;
CREATE POLICY payment_submissions_agent_scoped ON payment_submissions
  FOR SELECT USING (current_workcraft_role() = 'AGENT' AND agent_id = current_workcraft_agent_id());
DROP POLICY IF EXISTS payment_submissions_agent_insert ON payment_submissions;
CREATE POLICY payment_submissions_agent_insert ON payment_submissions
  FOR INSERT WITH CHECK (
    current_workcraft_role() = 'AGENT'
    AND agent_id = current_workcraft_agent_id()
    AND status = 'PENDING_REVIEW'
  );
DROP POLICY IF EXISTS payment_submissions_owner_scoped ON payment_submissions;
CREATE POLICY payment_submissions_owner_scoped ON payment_submissions
  FOR SELECT USING (current_workcraft_role() = 'SALON_OWNER' AND salon_id = current_workcraft_salon_id());
DROP POLICY IF EXISTS payment_submissions_owner_insert ON payment_submissions;
CREATE POLICY payment_submissions_owner_insert ON payment_submissions
  FOR INSERT WITH CHECK (
    current_workcraft_role() = 'SALON_OWNER'
    AND salon_id = current_workcraft_salon_id()
    AND status = 'PENDING_REVIEW'
  );

-- cash_custody_ledger & commission_ledger (Founder all; Agent scoped read/insert own)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY['cash_custody_ledger', 'commission_ledger'])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_founder_all', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (current_workcraft_role() = ''FOUNDER'') WITH CHECK (current_workcraft_role() = ''FOUNDER'')',
      tbl || '_founder_all',
      tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_agent_select', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (current_workcraft_role() = ''AGENT'' AND agent_id = current_workcraft_agent_id())',
      tbl || '_agent_select',
      tbl
    );
  END LOOP;
END $$;

COMMIT;
