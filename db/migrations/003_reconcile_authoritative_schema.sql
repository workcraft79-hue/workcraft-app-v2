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
--   * Enforces least-privilege PUBLIC_FLOW policies and scoped auth_challenges / salons_public_lookup
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
    NULLIF(pg_catalog.current_setting('app.current_user_role', TRUE), ''),
    NULLIF((NULLIF(pg_catalog.current_setting('request.jwt.claims', TRUE), '')::jsonb ->> 'user_role'), ''),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION current_workcraft_salon_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(pg_catalog.current_setting('app.current_salon_id', TRUE), ''),
    NULLIF((NULLIF(pg_catalog.current_setting('request.jwt.claims', TRUE), '')::jsonb ->> 'salon_id'), ''),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION current_workcraft_agent_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(pg_catalog.current_setting('app.current_agent_id', TRUE), ''),
    NULLIF((NULLIF(pg_catalog.current_setting('request.jwt.claims', TRUE), '')::jsonb ->> 'agent_id'), ''),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION current_workcraft_user_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(pg_catalog.current_setting('app.current_user_id', TRUE), ''),
    NULLIF((NULLIF(pg_catalog.current_setting('request.jwt.claims', TRUE), '')::jsonb ->> 'sub'), ''),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION current_workcraft_public_code()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(pg_catalog.current_setting('app.current_public_code', TRUE), ''),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION current_workcraft_challenge_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(pg_catalog.current_setting('app.current_challenge_id', TRUE), ''),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION current_workcraft_token_hash()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(pg_catalog.current_setting('app.current_token_hash', TRUE), ''),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION current_workcraft_booking_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(pg_catalog.current_setting('app.current_booking_id', TRUE), ''),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION current_workcraft_client_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(pg_catalog.current_setting('app.current_client_id', TRUE), ''),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION current_workcraft_idempotency_key()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(pg_catalog.current_setting('app.current_idempotency_key', TRUE), ''),
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

ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_monthly_booking_limit_check;
ALTER TABLE salons
  ADD CONSTRAINT salons_monthly_booking_limit_check
  CHECK (monthly_booking_limit > 0);

ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_grace_overage_limit_check;
ALTER TABLE salons
  ADD CONSTRAINT salons_grace_overage_limit_check
  CHECK (grace_overage_limit >= 0);

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

-- Reconcile app_users with TOTP, recovery codes, session version & multi-branch array
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS auth_phone TEXT,
  ADD COLUMN IF NOT EXISTS allowed_salon_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS totp_secret_enc TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recovery_codes_hashes JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_session_version_check;
ALTER TABLE app_users
  ADD CONSTRAINT app_users_session_version_check
  CHECK (session_version >= 1);

-- Reconcile services
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS buffer_after_mins INTEGER NOT NULL DEFAULT 0 CHECK (buffer_after_mins BETWEEN 0 AND 120),
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

-- Reconcile clients (keep id TEXT PK & existing columns, add Web-First columns)
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_preferred_language_check;
ALTER TABLE clients
  ADD CONSTRAINT clients_preferred_language_check
  CHECK (preferred_language IN ('en', 'roman_ur', 'ur', 'ar', 'it', 'ru', 'fr', 'de', 'es'));

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS phone_e164 TEXT,
  ADD COLUMN IF NOT EXISTS preferred_lang TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS birth_day_month TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS total_visits INTEGER NOT NULL DEFAULT 0 CHECK (total_visits >= 0),
  ADD COLUMN IF NOT EXISTS last_service_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  ADD COLUMN IF NOT EXISTS last_stylist_id UUID,
  ADD COLUMN IF NOT EXISTS marketing_opted_in BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS marketing_consent_source TEXT NOT NULL DEFAULT 'WEB_BOOKING',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_preferred_lang_check;
ALTER TABLE clients
  ADD CONSTRAINT clients_preferred_lang_check
  CHECK (preferred_lang IN ('en', 'roman_ur', 'ur', 'ar', 'it', 'ru', 'fr', 'de', 'es'));

-- Reconcile agent_invite_tokens (Founder-issued single-use invites only)
ALTER TABLE agent_invite_tokens
  ADD COLUMN IF NOT EXISTS permissions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'FOUNDER';

-- Mark migration transaction as FOUNDER across ALL idempotent backfills on FORCE-RLS 001 tables
SELECT set_config('app.current_user_role', 'FOUNDER', true);

UPDATE salons
SET
  public_code = COALESCE(
    NULLIF(BTRIM(public_code), ''),
    'wc_' || substring(encode(digest(id, 'sha256'), 'hex') from 1 for 16)
  ),
  owner_auth_phone = COALESCE(NULLIF(BTRIM(owner_auth_phone), ''), whatsapp_phone),
  public_contact_phone = COALESCE(NULLIF(BTRIM(public_contact_phone), ''), whatsapp_phone),
  currency_code = CASE
    WHEN (currency_code IS NULL OR BTRIM(currency_code) = '' OR currency_code = 'PKR')
         AND NULLIF(BTRIM(currency), '') IS NOT NULL
         AND currency <> 'PKR'
      THEN currency
    ELSE COALESCE(NULLIF(BTRIM(currency_code), ''), 'PKR')
  END,
  plan_tier = CASE
    WHEN NULLIF(BTRIM(plan_tier), '') IS NULL
         OR (plan_tier = 'PRO++' AND package_tier IS DISTINCT FROM 'PRO++')
      THEN package_tier
    ELSE plan_tier
  END
WHERE NULLIF(BTRIM(public_code), '') IS NULL
   OR NULLIF(BTRIM(owner_auth_phone), '') IS NULL
   OR NULLIF(BTRIM(public_contact_phone), '') IS NULL
   OR (currency_code = 'PKR' AND NULLIF(BTRIM(currency), '') IS NOT NULL AND currency <> 'PKR')
   OR NULLIF(BTRIM(currency_code), '') IS NULL
   OR NULLIF(BTRIM(plan_tier), '') IS NULL
   OR (plan_tier = 'PRO++' AND package_tier IS DISTINCT FROM 'PRO++');

UPDATE app_users
SET
  auth_phone = COALESCE(NULLIF(BTRIM(auth_phone), ''), NULLIF(BTRIM(phone), '')),
  allowed_salon_ids = CASE
    WHEN user_role = 'SALON_OWNER'
         AND NULLIF(BTRIM(salon_id), '') IS NOT NULL
         AND (allowed_salon_ids IS NULL OR cardinality(allowed_salon_ids) = 0)
      THEN ARRAY[salon_id]::TEXT[]
    ELSE COALESCE(allowed_salon_ids, ARRAY[]::TEXT[])
  END
WHERE (NULLIF(BTRIM(auth_phone), '') IS NULL AND NULLIF(BTRIM(phone), '') IS NOT NULL)
   OR (
     user_role = 'SALON_OWNER'
     AND NULLIF(BTRIM(salon_id), '') IS NOT NULL
     AND (allowed_salon_ids IS NULL OR cardinality(allowed_salon_ids) = 0)
   );

UPDATE services
SET active = COALESCE(is_active, TRUE)
WHERE active IS DISTINCT FROM COALESCE(is_active, TRUE);

UPDATE clients
SET
  phone_e164 = COALESCE(NULLIF(BTRIM(phone_e164), ''), NULLIF(BTRIM(phone), '')),
  preferred_lang = COALESCE(NULLIF(BTRIM(preferred_language), ''), NULLIF(BTRIM(preferred_lang), ''), 'en'),
  birth_day_month = COALESCE(NULLIF(BTRIM(birth_day_month), ''), NULLIF(BTRIM(birth_date), ''), '')
WHERE NULLIF(BTRIM(phone_e164), '') IS NULL
   OR NULLIF(BTRIM(preferred_lang), '') IS NULL
   OR (NULLIF(BTRIM(birth_day_month), '') IS NULL AND NULLIF(BTRIM(birth_date), '') IS NOT NULL);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_salon_phone_e164_key'
  ) THEN
    ALTER TABLE clients ADD CONSTRAINT clients_salon_phone_e164_key UNIQUE (salon_id, phone_e164);
  END IF;
END $$;

-- Enforce unprivileged STARTER defaults on future salon inserts after 001 backfill completes
ALTER TABLE salons
  ALTER COLUMN package_tier SET DEFAULT 'STARTER',
  ALTER COLUMN plan_tier SET DEFAULT 'STARTER',
  ALTER COLUMN monthly_booking_limit SET DEFAULT 750;

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
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
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

-- Non-destructive copy of any existing 001 barbers into stylists (runs under FOUNDER GUC)
INSERT INTO stylists (id, salon_id, name, chair_label, active, created_at)
SELECT b.id, b.salon_id, b.name, b.chair_label, b.is_active, b.created_at
FROM barbers b
ON CONFLICT DO NOTHING;

-- Clear temporary migration FOUNDER role now that all 001/003 backfills are complete
SELECT set_config('app.current_user_role', '', true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_last_stylist_id_fkey'
  ) THEN
    ALTER TABLE clients
      ADD CONSTRAINT clients_last_stylist_id_fkey
      FOREIGN KEY (last_stylist_id) REFERENCES stylists(id) ON DELETE SET NULL;
  END IF;
END $$;

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
  usage_counted BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at),
  UNIQUE (salon_id, idempotency_key),
  CONSTRAINT bookings_no_stylist_overlap EXCLUDE USING gist (
    stylist_id WITH =,
    occupied_range WITH &&
  ) WHERE (status IN ('CONFIRMED', 'IN_CHAIR'))
);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS usage_counted BOOLEAN NOT NULL DEFAULT FALSE;

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
  limit_snapshot INTEGER NOT NULL CHECK (limit_snapshot > 0),
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
  queue_position INTEGER NOT NULL DEFAULT 1 CHECK (queue_position >= 1),
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
  commission_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (commission_pct >= 0 AND commission_pct <= 100),
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
CREATE INDEX IF NOT EXISTS idx_bookings_salon_ref ON bookings (salon_id, booking_ref);
CREATE INDEX IF NOT EXISTS idx_bookings_stylist_starts ON bookings (stylist_id, starts_at) WHERE status IN ('CONFIRMED', 'IN_CHAIR');
CREATE INDEX IF NOT EXISTS idx_booking_audit_log_salon_created ON booking_audit_log (salon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_access_tokens_booking ON booking_access_tokens (booking_id);
CREATE INDEX IF NOT EXISTS idx_stylists_salon ON stylists (salon_id);
CREATE INDEX IF NOT EXISTS idx_stylist_leaves_stylist ON stylist_leaves (stylist_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_stylist_leaves_salon_window ON stylist_leaves (salon_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_deals_salon_active ON deals (salon_id, active, expires_at);
CREATE INDEX IF NOT EXISTS idx_counter_notifications_salon ON counter_notifications (salon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_status ON payment_submissions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_salon ON payment_submissions (salon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_agent ON payment_submissions (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_custody_ledger_agent ON cash_custody_ledger (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_agent ON commission_ledger (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_challenges_user_purpose ON auth_challenges (user_id, purpose, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_challenges_expires ON auth_challenges (expires_at);
CREATE INDEX IF NOT EXISTS idx_salon_memberships_salon ON salon_memberships (salon_id);
CREATE INDEX IF NOT EXISTS idx_walk_in_queue_salon ON walk_in_queue (salon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bridal_bookings_salon ON bridal_bookings (salon_id, event_date);
CREATE INDEX IF NOT EXISTS idx_service_packages_salon ON service_packages (salon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_threads_salon ON voice_threads (salon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_browser_tokens_salon_client ON client_browser_tokens (salon_id, client_id);

-- -----------------------------------------------------------------------------
-- 7. Triggers & Controlled PUBLIC_FLOW Database Functions
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION guard_salon_billing_status_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF public.current_workcraft_role() = 'FOUNDER' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.billing_status IS DISTINCT FROM 'PENDING_ACTIVATION'
       OR NEW.package_tier IS DISTINCT FROM 'STARTER'
       OR NEW.plan_tier IS DISTINCT FROM 'STARTER'
       OR NEW.monthly_booking_limit IS DISTINCT FROM 750
       OR NEW.grace_overage_limit IS DISTINCT FROM 150
       OR NEW.billing_cycle_start IS DISTINCT FROM CURRENT_DATE
       OR NEW.whatsapp_addon_enabled IS TRUE
       OR NEW.meta_phone_number_id IS NOT NULL
       OR (
         public.current_workcraft_role() = 'AGENT'
         AND (
           NULLIF(public.current_workcraft_agent_id(), '') IS NULL
           OR NEW.assigned_agent_id IS DISTINCT FROM public.current_workcraft_agent_id()
         )
       )
       OR (
         public.current_workcraft_role() <> 'AGENT'
         AND NEW.assigned_agent_id IS NOT NULL
       ) THEN
      RAISE EXCEPTION 'Only FOUNDER may provision non-starter salon tier, custom limits, active billing status/cycle, WhatsApp entitlements, Meta phone ID, or arbitrary agent assignment';
    END IF;
    RETURN NEW;
  END IF;

  IF (NEW.billing_status IS DISTINCT FROM OLD.billing_status
      OR NEW.package_tier IS DISTINCT FROM OLD.package_tier
      OR NEW.plan_tier IS DISTINCT FROM OLD.plan_tier
      OR NEW.monthly_booking_limit IS DISTINCT FROM OLD.monthly_booking_limit
      OR NEW.grace_overage_limit IS DISTINCT FROM OLD.grace_overage_limit
      OR NEW.billing_cycle_start IS DISTINCT FROM OLD.billing_cycle_start
      OR NEW.whatsapp_addon_enabled IS DISTINCT FROM OLD.whatsapp_addon_enabled
      OR NEW.meta_phone_number_id IS DISTINCT FROM OLD.meta_phone_number_id
      OR NEW.assigned_agent_id IS DISTINCT FROM OLD.assigned_agent_id) THEN
    RAISE EXCEPTION 'Only FOUNDER may modify salon billing_status, tier, quotas, billing_cycle_start, add-on entitlements, meta_phone_number_id, or assigned_agent_id';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_salon_billing_status ON salons;
CREATE TRIGGER trg_guard_salon_billing_status
  BEFORE INSERT OR UPDATE ON salons
  FOR EACH ROW
  EXECUTE FUNCTION guard_salon_billing_status_update();

-- Restrict auth_challenges updates to valid attempt increments & consumption only
CREATE OR REPLACE FUNCTION guard_auth_challenges_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF public.current_workcraft_role() = 'FOUNDER' THEN
    RETURN NEW;
  END IF;

  IF OLD.consumed_at IS NOT NULL OR OLD.expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION 'Expired or consumed auth_challenges cannot be modified';
  END IF;

  IF (NEW.id IS DISTINCT FROM OLD.id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.target_phone IS DISTINCT FROM OLD.target_phone
      OR NEW.purpose IS DISTINCT FROM OLD.purpose
      OR NEW.code_hash IS DISTINCT FROM OLD.code_hash
      OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
      OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
    RAISE EXCEPTION 'Only attempts and consumed_at may be updated on auth_challenges';
  END IF;

  IF OLD.attempts >= 5 OR NEW.attempts < OLD.attempts OR NEW.attempts > 5 THEN
    RAISE EXCEPTION 'auth_challenges verification attempt limit exceeded or invalid attempt count';
  END IF;

  IF NEW.consumed_at IS NULL THEN
    IF NEW.attempts IS DISTINCT FROM OLD.attempts + 1 THEN
      RAISE EXCEPTION 'Failed auth_challenges update must increment attempts by exactly 1';
    END IF;
  ELSE
    IF NEW.attempts NOT IN (OLD.attempts, OLD.attempts + 1) THEN
      RAISE EXCEPTION 'Invalid attempts transition while consuming auth_challenge';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_auth_challenges_update ON auth_challenges;
CREATE TRIGGER trg_guard_auth_challenges_update
  BEFORE UPDATE ON auth_challenges
  FOR EACH ROW
  EXECUTE FUNCTION guard_auth_challenges_update();

-- Restrict PUBLIC_FLOW updates on booking_access_tokens to bounded expires_at extension only
CREATE OR REPLACE FUNCTION guard_booking_access_tokens_public_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF public.current_workcraft_role() <> 'PUBLIC_FLOW' THEN
    RETURN NEW;
  END IF;

  IF (NEW.id IS DISTINCT FROM OLD.id
      OR NEW.token_hash IS DISTINCT FROM OLD.token_hash
      OR NEW.booking_id IS DISTINCT FROM OLD.booking_id
      OR NEW.salon_id IS DISTINCT FROM OLD.salon_id
      OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.expires_at <= pg_catalog.now()
      OR NEW.expires_at > pg_catalog.now() + INTERVAL '365 days') THEN
    RAISE EXCEPTION 'PUBLIC_FLOW may only extend expires_at on its verified active booking access token';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_booking_access_tokens_public_update ON booking_access_tokens;
CREATE TRIGGER trg_guard_booking_access_tokens_public_update
  BEFORE UPDATE ON booking_access_tokens
  FOR EACH ROW
  EXECUTE FUNCTION guard_booking_access_tokens_public_update();

-- Controlled non-PII busy slot query for availability (eliminates direct PUBLIC_FLOW bookings SELECT)
CREATE OR REPLACE FUNCTION get_public_stylist_busy_blocks(
  p_salon_id TEXT,
  p_window_start TIMESTAMPTZ,
  p_window_end TIMESTAMPTZ,
  p_exclude_booking TEXT DEFAULT NULL
)
RETURNS TABLE (
  stylist_id UUID,
  stylist_name TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  status TEXT,
  total_duration_mins INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF public.current_workcraft_role() NOT IN ('FOUNDER', 'SALON_OWNER', 'PUBLIC_FLOW') THEN
    RAISE EXCEPTION 'Unauthorized role for stylist busy block lookup';
  END IF;

  IF public.current_workcraft_role() <> 'FOUNDER' THEN
    IF NULLIF(public.current_workcraft_salon_id(), '') IS NULL OR p_salon_id IS DISTINCT FROM public.current_workcraft_salon_id() THEN
      RAISE EXCEPTION 'Tenant mismatch for stylist busy block lookup';
    END IF;
  END IF;

  IF p_window_end <= p_window_start OR p_window_end - p_window_start > INTERVAL '14 days' THEN
    RAISE EXCEPTION 'Invalid availability query window';
  END IF;

  RETURN QUERY
  SELECT
    b.stylist_id,
    st.name AS stylist_name,
    b.starts_at,
    b.ends_at,
    b.status,
    b.total_duration_mins
  FROM public.bookings b
  JOIN public.stylists st ON st.id = b.stylist_id
  WHERE b.salon_id = p_salon_id
    AND b.status IN ('CONFIRMED', 'IN_CHAIR')
    AND b.ends_at > p_window_start
    AND b.starts_at < p_window_end
    AND (p_exclude_booking IS NULL OR (b.id::text <> p_exclude_booking AND b.booking_ref <> p_exclude_booking))
  ORDER BY b.starts_at ASC;
END;
$$;

-- Controlled client upsert for public booking creation (returns client_id only; never exposes client directory)
CREATE OR REPLACE FUNCTION upsert_public_booking_client(
  p_salon_id TEXT,
  p_generated_id TEXT,
  p_name TEXT,
  p_phone_e164 TEXT,
  p_preferred_lang TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_client_id TEXT;
  v_clean_lang TEXT;
  v_caller_role TEXT;
  v_prev_role TEXT;
  v_prev_salon_id TEXT;
  v_owner_bypasses_rls BOOLEAN := FALSE;
BEGIN
  v_caller_role := public.current_workcraft_role();
  IF v_caller_role NOT IN ('FOUNDER', 'SALON_OWNER', 'PUBLIC_FLOW') THEN
    RAISE EXCEPTION 'Unauthorized role for booking client upsert';
  END IF;

  IF v_caller_role <> 'FOUNDER' THEN
    IF NULLIF(public.current_workcraft_salon_id(), '') IS NULL OR p_salon_id IS DISTINCT FROM public.current_workcraft_salon_id() THEN
      RAISE EXCEPTION 'Tenant mismatch for booking client upsert';
    END IF;
  END IF;

  IF NULLIF(pg_catalog.btrim(p_salon_id), '') IS NULL
     OR NULLIF(pg_catalog.btrim(p_generated_id), '') IS NULL
     OR NULLIF(pg_catalog.btrim(p_name), '') IS NULL
     OR NULLIF(pg_catalog.btrim(p_phone_e164), '') IS NULL THEN
    RAISE EXCEPTION 'Missing required client fields for booking';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.salons s
    WHERE s.id = p_salon_id
      AND s.billing_status <> 'SUSPENDED'
  ) THEN
    RAISE EXCEPTION 'Salon is unavailable or suspended';
  END IF;

  v_clean_lang := CASE
    WHEN p_preferred_lang IN ('en', 'roman_ur', 'ur', 'ar', 'it', 'ru', 'fr', 'de', 'es')
      THEN p_preferred_lang
    ELSE 'en'
  END;

  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles r
    WHERE r.rolname = CURRENT_USER
      AND (r.rolsuper OR r.rolbypassrls)
  ) INTO v_owner_bypasses_rls;

  v_prev_role := COALESCE(pg_catalog.current_setting('app.current_user_role', TRUE), '');
  v_prev_salon_id := COALESCE(pg_catalog.current_setting('app.current_salon_id', TRUE), '');

  BEGIN
    IF NOT v_owner_bypasses_rls AND v_caller_role = 'PUBLIC_FLOW' THEN
      PERFORM pg_catalog.set_config('app.current_user_role', 'SALON_OWNER', true);
      PERFORM pg_catalog.set_config('app.current_salon_id', p_salon_id, true);
    END IF;

    INSERT INTO public.clients (
      id, salon_id, name, phone, phone_e164, preferred_language, preferred_lang, awaiting_language_selection
    )
    VALUES (
      p_generated_id,
      p_salon_id,
      pg_catalog.btrim(p_name),
      pg_catalog.btrim(p_phone_e164),
      pg_catalog.btrim(p_phone_e164),
      v_clean_lang,
      v_clean_lang,
      FALSE
    )
    ON CONFLICT (salon_id, phone_e164) DO UPDATE SET
      name = EXCLUDED.name,
      preferred_language = EXCLUDED.preferred_language,
      preferred_lang = EXCLUDED.preferred_lang,
      updated_at = pg_catalog.now()
    RETURNING id INTO v_client_id;

    IF NOT v_owner_bypasses_rls AND v_caller_role = 'PUBLIC_FLOW' THEN
      PERFORM pg_catalog.set_config('app.current_user_role', v_prev_role, true);
      PERFORM pg_catalog.set_config('app.current_salon_id', v_prev_salon_id, true);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      IF NOT v_owner_bypasses_rls AND v_caller_role = 'PUBLIC_FLOW' THEN
        PERFORM pg_catalog.set_config('app.current_user_role', v_prev_role, true);
        PERFORM pg_catalog.set_config('app.current_salon_id', v_prev_salon_id, true);
      END IF;
      RAISE;
  END;

  PERFORM pg_catalog.set_config('app.current_client_id', v_client_id, true);
  RETURN v_client_id;
END;
$$;

-- Controlled monthly booking counter increment (+1 per uncounted CONFIRMED booking, authoritative quota check)
-- Defined BEFORE guard_bookings_public_update() so the trigger can verify SECURITY DEFINER function ownership.
CREATE OR REPLACE FUNCTION increment_salon_monthly_booking_usage(
  p_salon_id TEXT,
  p_booking_id UUID,
  p_billing_month TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_prev_role TEXT;
  v_prev_salon_id TEXT;
  v_owner_bypasses_rls BOOLEAN := FALSE;
  v_billing_status TEXT;
  v_monthly_limit INTEGER;
  v_grace_limit INTEGER;
  v_counted_booking UUID;
  v_next_billable INTEGER;
BEGIN
  v_caller_role := public.current_workcraft_role();
  IF v_caller_role NOT IN ('FOUNDER', 'SALON_OWNER', 'PUBLIC_FLOW') THEN
    RAISE EXCEPTION 'Unauthorized role for salon usage increment';
  END IF;

  IF v_caller_role <> 'FOUNDER' THEN
    IF NULLIF(public.current_workcraft_salon_id(), '') IS NULL OR p_salon_id IS DISTINCT FROM public.current_workcraft_salon_id() THEN
      RAISE EXCEPTION 'Tenant mismatch for salon usage increment';
    END IF;
  END IF;

  IF p_booking_id IS NULL THEN
    RAISE EXCEPTION 'Booking id is required for salon usage increment';
  END IF;

  IF v_caller_role = 'PUBLIC_FLOW' THEN
    IF NOT (
      (
        NULLIF(public.current_workcraft_booking_id(), '') IS NOT NULL
        AND p_booking_id::text = public.current_workcraft_booking_id()
      )
      OR (
        NULLIF(public.current_workcraft_token_hash(), '') IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.booking_access_tokens bat
          WHERE bat.booking_id = p_booking_id
            AND bat.salon_id = p_salon_id
            AND bat.token_hash = public.current_workcraft_token_hash()
            AND bat.revoked_at IS NULL
            AND bat.expires_at > pg_catalog.now()
        )
      )
    ) THEN
      RAISE EXCEPTION 'PUBLIC_FLOW caller is not authorized to count usage for booking %', p_booking_id;
    END IF;
  END IF;

  IF p_billing_month IS NULL OR p_billing_month !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Invalid billing_month format (expected YYYY-MM)';
  END IF;

  SELECT s.billing_status, s.monthly_booking_limit, s.grace_overage_limit
    INTO v_billing_status, v_monthly_limit, v_grace_limit
  FROM public.salons s
  WHERE s.id = p_salon_id
  FOR UPDATE;

  IF NOT FOUND OR v_billing_status = 'SUSPENDED' THEN
    RAISE EXCEPTION 'Salon not found or suspended';
  END IF;

  -- Mark usage_counted = TRUE under caller's active role so guard_bookings_public_update()
  -- runs and authorizes this transition exclusively via SECURITY DEFINER owner + internal GUC.
  BEGIN
    PERFORM pg_catalog.set_config('app._usage_mark_booking_id', p_booking_id::text, true);

    UPDATE public.bookings b
    SET usage_counted = TRUE
    WHERE b.id = p_booking_id
      AND b.salon_id = p_salon_id
      AND b.status = 'CONFIRMED'
      AND b.usage_counted = FALSE
    RETURNING b.id INTO v_counted_booking;

    PERFORM pg_catalog.set_config('app._usage_mark_booking_id', '', true);
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_catalog.set_config('app._usage_mark_booking_id', '', true);
      RAISE;
  END;

  IF v_counted_booking IS NULL THEN
    RAISE EXCEPTION 'Usage increment requires an uncounted CONFIRMED booking in the scoped salon';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles r
    WHERE r.rolname = CURRENT_USER
      AND (r.rolsuper OR r.rolbypassrls)
  ) INTO v_owner_bypasses_rls;

  v_prev_role := COALESCE(pg_catalog.current_setting('app.current_user_role', TRUE), '');
  v_prev_salon_id := COALESCE(pg_catalog.current_setting('app.current_salon_id', TRUE), '');

  BEGIN
    IF NOT v_owner_bypasses_rls AND v_caller_role = 'PUBLIC_FLOW' THEN
      PERFORM pg_catalog.set_config('app.current_user_role', 'SALON_OWNER', true);
      PERFORM pg_catalog.set_config('app.current_salon_id', p_salon_id, true);
    END IF;

    INSERT INTO public.salon_usage_monthly (
      salon_id, billing_month, billable_bookings, overage_bookings, limit_snapshot, updated_at
    )
    VALUES (
      p_salon_id,
      p_billing_month,
      1,
      CASE WHEN 1 > v_monthly_limit THEN 1 - v_monthly_limit ELSE 0 END,
      v_monthly_limit,
      pg_catalog.now()
    )
    ON CONFLICT (salon_id, billing_month) DO UPDATE SET
      billable_bookings = salon_usage_monthly.billable_bookings + 1,
      overage_bookings = GREATEST(0, (salon_usage_monthly.billable_bookings + 1) - v_monthly_limit),
      limit_snapshot = v_monthly_limit,
      updated_at = pg_catalog.now()
    RETURNING billable_bookings INTO v_next_billable;

    IF NOT v_owner_bypasses_rls AND v_caller_role = 'PUBLIC_FLOW' THEN
      PERFORM pg_catalog.set_config('app.current_user_role', v_prev_role, true);
      PERFORM pg_catalog.set_config('app.current_salon_id', v_prev_salon_id, true);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      IF NOT v_owner_bypasses_rls AND v_caller_role = 'PUBLIC_FLOW' THEN
        PERFORM pg_catalog.set_config('app.current_user_role', v_prev_role, true);
        PERFORM pg_catalog.set_config('app.current_salon_id', v_prev_salon_id, true);
      END IF;
      RAISE;
  END;

  IF v_next_billable > (v_monthly_limit + v_grace_limit) THEN
    RAISE EXCEPTION 'QUOTA_EXCEEDED: Salon % reached monthly online booking capacity (% + %)',
      p_salon_id, v_monthly_limit, v_grace_limit
      USING ERRCODE = 'P0002';
  END IF;

  RETURN v_next_billable;
END;
$$;

-- Restrict PUBLIC_FLOW updates on bookings to stylist/time reschedule, CANCELED status, or controlled quota marking
CREATE OR REPLACE FUNCTION guard_bookings_public_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_usage_fn_owner NAME;
BEGIN
  IF public.current_workcraft_role() <> 'PUBLIC_FLOW' THEN
    RETURN NEW;
  END IF;

  IF NEW.usage_counted IS DISTINCT FROM OLD.usage_counted THEN
    SELECT pg_catalog.pg_get_userbyid(p.proowner)
      INTO v_usage_fn_owner
    FROM pg_catalog.pg_proc p
    WHERE p.oid = pg_catalog.to_regprocedure('public.increment_salon_monthly_booking_usage(text, uuid, text)')
      AND p.prosecdef IS TRUE;

    IF OLD.usage_counted IS FALSE
       AND NEW.usage_counted IS TRUE
       AND OLD.status = 'CONFIRMED'
       AND NEW.status = 'CONFIRMED'
       AND v_usage_fn_owner IS NOT NULL
       AND CURRENT_USER = v_usage_fn_owner
       AND NULLIF(pg_catalog.current_setting('app._usage_mark_booking_id', TRUE), '') IS NOT DISTINCT FROM OLD.id::text
       AND NEW.id IS NOT DISTINCT FROM OLD.id
       AND NEW.salon_id IS NOT DISTINCT FROM OLD.salon_id
       AND NEW.client_id IS NOT DISTINCT FROM OLD.client_id
       AND NEW.stylist_id IS NOT DISTINCT FROM OLD.stylist_id
       AND NEW.booking_ref IS NOT DISTINCT FROM OLD.booking_ref
       AND NEW.services_snapshot IS NOT DISTINCT FROM OLD.services_snapshot
       AND NEW.total_price IS NOT DISTINCT FROM OLD.total_price
       AND NEW.total_duration_mins IS NOT DISTINCT FROM OLD.total_duration_mins
       AND NEW.starts_at IS NOT DISTINCT FROM OLD.starts_at
       AND NEW.ends_at IS NOT DISTINCT FROM OLD.ends_at
       AND NEW.source IS NOT DISTINCT FROM OLD.source
       AND NEW.deal_id IS NOT DISTINCT FROM OLD.deal_id
       AND NEW.idempotency_key IS NOT DISTINCT FROM OLD.idempotency_key
       AND NEW.proof_hash IS NOT DISTINCT FROM OLD.proof_hash
       AND NEW.completed_at IS NOT DISTINCT FROM OLD.completed_at
       AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'PUBLIC_FLOW may not directly modify bookings.usage_counted';
  END IF;

  IF (NEW.id IS DISTINCT FROM OLD.id
      OR NEW.salon_id IS DISTINCT FROM OLD.salon_id
      OR NEW.client_id IS DISTINCT FROM OLD.client_id
      OR NEW.booking_ref IS DISTINCT FROM OLD.booking_ref
      OR NEW.services_snapshot IS DISTINCT FROM OLD.services_snapshot
      OR NEW.total_price IS DISTINCT FROM OLD.total_price
      OR NEW.total_duration_mins IS DISTINCT FROM OLD.total_duration_mins
      OR NEW.source IS DISTINCT FROM OLD.source
      OR NEW.deal_id IS DISTINCT FROM OLD.deal_id
      OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
      OR NEW.proof_hash IS DISTINCT FROM OLD.proof_hash
      OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
      OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
    RAISE EXCEPTION 'PUBLIC_FLOW may only reschedule stylist/time or cancel its authorized booking';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_bookings_public_update ON bookings;
CREATE TRIGGER trg_guard_bookings_public_update
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION guard_bookings_public_update();

-- Least-privilege function EXECUTE grants & SECURITY DEFINER ownership/search_path audit
REVOKE ALL ON FUNCTION public.guard_salon_billing_status_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_auth_challenges_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_booking_access_tokens_public_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_bookings_public_update() FROM PUBLIC;

REVOKE ALL ON FUNCTION public.get_public_stylist_busy_blocks(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_public_booking_client(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_salon_monthly_booking_usage(TEXT, UUID, TEXT) FROM PUBLIC;

DO $$
DECLARE
  r RECORD;
  v_sig TEXT;
  v_fn REGPROCEDURE;
  v_owner NAME;
  v_secdef BOOLEAN;
  v_has_safe_search_path BOOLEAN;
BEGIN
  EXECUTE format(
    'GRANT EXECUTE ON FUNCTION public.get_public_stylist_busy_blocks(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO %I',
    CURRENT_USER
  );
  EXECUTE format(
    'GRANT EXECUTE ON FUNCTION public.upsert_public_booking_client(TEXT, TEXT, TEXT, TEXT, TEXT) TO %I',
    CURRENT_USER
  );
  EXECUTE format(
    'GRANT EXECUTE ON FUNCTION public.increment_salon_monthly_booking_usage(TEXT, UUID, TEXT) TO %I',
    CURRENT_USER
  );

  FOR r IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname = 'staging_app_role'
       OR (
         rolcanlogin
         AND rolname !~ '^pg_'
         AND pg_catalog.has_table_privilege(oid, 'public.bookings'::regclass, 'INSERT')
       )
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.get_public_stylist_busy_blocks(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO %I',
      r.rolname
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.upsert_public_booking_client(TEXT, TEXT, TEXT, TEXT, TEXT) TO %I',
      r.rolname
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.increment_salon_monthly_booking_usage(TEXT, UUID, TEXT) TO %I',
      r.rolname
    );
  END LOOP;

  FOREACH v_sig IN ARRAY ARRAY[
    'public.get_public_stylist_busy_blocks(text, timestamptz, timestamptz, text)',
    'public.upsert_public_booking_client(text, text, text, text, text)',
    'public.increment_salon_monthly_booking_usage(text, uuid, text)'
  ]
  LOOP
    v_fn := pg_catalog.to_regprocedure(v_sig);
    IF v_fn IS NULL THEN
      RAISE EXCEPTION 'Missing required SECURITY DEFINER function: %', v_sig;
    END IF;

    SELECT
      pg_catalog.pg_get_userbyid(p.proowner),
      p.prosecdef,
      pg_catalog.array_to_string(COALESCE(p.proconfig, ARRAY[]::TEXT[]), '|') LIKE '%search_path=%pg_catalog%public%pg_temp%'
    INTO v_owner, v_secdef, v_has_safe_search_path
    FROM pg_catalog.pg_proc p
    WHERE p.oid = v_fn;

    IF v_owner IS NULL OR v_owner = 'staging_app_role' THEN
      RAISE EXCEPTION 'SECURITY DEFINER function % has unsafe owner %', v_sig, COALESCE(v_owner::text, '<null>');
    END IF;
    IF v_secdef IS NOT TRUE THEN
      RAISE EXCEPTION 'Controlled RPC % must be SECURITY DEFINER', v_sig;
    END IF;
    IF v_has_safe_search_path IS NOT TRUE THEN
      RAISE EXCEPTION 'SECURITY DEFINER function % must set search_path = pg_catalog, public, pg_temp', v_sig;
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 8. Unified Row-Level Security (FORCE RLS on All 34 Tables + Least Privilege)
-- -----------------------------------------------------------------------------

-- Re-assert ENABLE & FORCE ROW LEVEL SECURITY on all 9 base 001 tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'app_users', 'salons', 'barbers', 'services', 'appointments',
      'clients', 'whatsapp_messages', 'alerts', 'agent_invite_tokens'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

-- Public storefront lookup on salons: strictly scoped to the resolved salon_id OR requested public_code
DROP POLICY IF EXISTS salons_public_lookup ON salons;
CREATE POLICY salons_public_lookup ON salons
  FOR SELECT
  USING (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND NULLIF(BTRIM(public_code), '') IS NOT NULL
    AND billing_status <> 'SUSPENDED'
    AND (
      (
        NULLIF(current_workcraft_salon_id(), '') IS NOT NULL
        AND id = current_workcraft_salon_id()
      )
      OR (
        NULLIF(current_workcraft_salon_id(), '') IS NULL
        AND NULLIF(current_workcraft_public_code(), '') IS NOT NULL
        AND public_code = current_workcraft_public_code()
      )
    )
  );

-- Clients: PUBLIC_FLOW SELECT only for verified session client_id or verified active booking access token
DROP POLICY IF EXISTS clients_public_flow_scoped ON clients;
DROP POLICY IF EXISTS clients_public_flow_insert ON clients;
DROP POLICY IF EXISTS clients_public_flow_update ON clients;
DROP POLICY IF EXISTS clients_public_flow_select ON clients;
CREATE POLICY clients_public_flow_select ON clients
  FOR SELECT
  USING (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND NULLIF(current_workcraft_salon_id(), '') IS NOT NULL
    AND salon_id = current_workcraft_salon_id()
    AND (
      (
        NULLIF(current_workcraft_client_id(), '') IS NOT NULL
        AND id = current_workcraft_client_id()
      )
      OR (
        NULLIF(current_workcraft_token_hash(), '') IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM bookings b
          JOIN booking_access_tokens bat
            ON bat.booking_id = b.id
           AND bat.salon_id = b.salon_id
          WHERE b.client_id = clients.id
            AND b.salon_id = current_workcraft_salon_id()
            AND bat.token_hash = current_workcraft_token_hash()
            AND bat.revoked_at IS NULL
            AND bat.expires_at > NOW()
        )
      )
    )
  );

-- Services: PUBLIC_FLOW SELECT only, scoped to current_workcraft_salon_id()
DROP POLICY IF EXISTS services_public_flow_select ON services;
CREATE POLICY services_public_flow_select ON services
  FOR SELECT
  USING (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND NULLIF(current_workcraft_salon_id(), '') IS NOT NULL
    AND salon_id = current_workcraft_salon_id()
  );

-- Tenant-scoped 003 operational tables (ENABLE + FORCE RLS, Founder & Salon Owner isolation)
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
      'CREATE POLICY %I ON %I FOR ALL USING (current_workcraft_role() = ''SALON_OWNER'' AND NULLIF(current_workcraft_salon_id(), '''') IS NOT NULL AND salon_id = current_workcraft_salon_id()) WITH CHECK (current_workcraft_role() = ''SALON_OWNER'' AND NULLIF(current_workcraft_salon_id(), '''') IS NOT NULL AND salon_id = current_workcraft_salon_id())',
      tbl || '_owner_isolated',
      tbl
    );
  END LOOP;
END $$;

-- Remove legacy broad FOR ALL PUBLIC_FLOW policies before applying granular least-privilege policies
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
  END LOOP;
END $$;

-- stylists: PUBLIC_FLOW SELECT / INSERT / UPDATE (for ON CONFLICT DO UPDATE); NO DELETE
DROP POLICY IF EXISTS stylists_public_flow_select ON stylists;
CREATE POLICY stylists_public_flow_select ON stylists
  FOR SELECT
  USING (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND NULLIF(current_workcraft_salon_id(), '') IS NOT NULL
    AND salon_id = current_workcraft_salon_id()
  );

DROP POLICY IF EXISTS stylists_public_flow_insert ON stylists;
CREATE POLICY stylists_public_flow_insert ON stylists
  FOR INSERT
  WITH CHECK (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND NULLIF(current_workcraft_salon_id(), '') IS NOT NULL
    AND salon_id = current_workcraft_salon_id()
  );

DROP POLICY IF EXISTS stylists_public_flow_update ON stylists;
CREATE POLICY stylists_public_flow_update ON stylists
  FOR UPDATE
  USING (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND NULLIF(current_workcraft_salon_id(), '') IS NOT NULL
    AND salon_id = current_workcraft_salon_id()
  )
  WITH CHECK (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND NULLIF(current_workcraft_salon_id(), '') IS NOT NULL
    AND salon_id = current_workcraft_salon_id()
  );

-- stylist_leaves: PUBLIC_FLOW SELECT only
DROP POLICY IF EXISTS stylist_leaves_public_flow_select ON stylist_leaves;
CREATE POLICY stylist_leaves_public_flow_select ON stylist_leaves
  FOR SELECT
  USING (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND NULLIF(current_workcraft_salon_id(), '') IS NOT NULL
    AND salon_id = current_workcraft_salon_id()
  );

-- deals: PUBLIC_FLOW SELECT only (active/non-deleted storefront view)
DROP POLICY IF EXISTS deals_public_flow_select ON deals;
CREATE POLICY deals_public_flow_select ON deals
  FOR SELECT
  USING (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND NULLIF(current_workcraft_salon_id(), '') IS NOT NULL
    AND salon_id = current_workcraft_salon_id()
  );

-- bookings: PUBLIC_FLOW restricted strictly to verified token/session/new-booking/idempotency; NO DELETE
DROP POLICY IF EXISTS bookings_public_flow_select ON bookings;
CREATE POLICY bookings_public_flow_select ON bookings
  FOR SELECT
  USING (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND NULLIF(current_workcraft_salon_id(), '') IS NOT NULL
    AND salon_id = current_workcraft_salon_id()
    AND (
      (
        NULLIF(current_workcraft_token_hash(), '') IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM booking_access_tokens bat
          WHERE bat.booking_id = bookings.id
            AND bat.salon_id = current_workcraft_salon_id()
            AND bat.token_hash = current_workcraft_token_hash()
            AND bat.revoked_at IS NULL
            AND bat.expires_at > NOW()
        )
      )
      OR (
        NULLIF(current_workcraft_client_id(), '') IS NOT NULL
        AND client_id = current_workcraft_client_id()
      )
      OR (
        NULLIF(current_workcraft_booking_id(), '') IS NOT NULL
        AND id::text = current_workcraft_booking_id()
      )
      OR (
        NULLIF(current_workcraft_idempotency_key(), '') IS NOT NULL
        AND idempotency_key = current_workcraft_idempotency_key()
      )
    )
  );

DROP POLICY IF EXISTS bookings_public_flow_insert ON bookings;
CREATE POLICY bookings_public_flow_insert ON bookings
  FOR INSERT
  WITH CHECK (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND NULLIF(current_workcraft_salon_id(), '') IS NOT NULL
    AND salon_id = current_workcraft_salon_id()
    AND status = 'CONFIRMED'
    AND usage_counted = FALSE
    AND NULLIF(current_workcraft_client_id(), '') IS NOT NULL
    AND client_id = current_workcraft_client_id()
    AND NULLIF(current_workcraft_booking_id(), '') IS NOT NULL
    AND id::text = current_workcraft_booking_id()
  );

DROP POLICY IF EXISTS bookings_public_flow_update ON bookings;
CREATE POLICY bookings_public_flow_update ON bookings
  FOR UPDATE
  USING (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND NULLIF(current_workcraft_salon_id(), '') IS NOT NULL
    AND salon_id = current_workcraft_salon_id()
    AND status IN ('CONFIRMED', 'IN_CHAIR')
    AND NULLIF(current_workcraft_token_hash(), '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM booking_access_tokens bat
      WHERE bat.booking_id = bookings.id
        AND bat.salon_id = current_workcraft_salon_id()
        AND bat.token_hash = current_workcraft_token_hash()
        AND bat.revoked_at IS NULL
        AND bat.expires_at > NOW()
    )
  )
  WITH CHECK (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND NULLIF(current_workcraft_salon_id(), '') IS NOT NULL
    AND salon_id = current_workcraft_salon_id()
    AND status IN ('CONFIRMED', 'IN_CHAIR', 'CANCELED')
    AND NULLIF(current_workcraft_token_hash(), '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM booking_access_tokens bat
      WHERE bat.booking_id = bookings.id
        AND bat.salon_id = current_workcraft_salon_id()
        AND bat.token_hash = current_workcraft_token_hash()
        AND bat.revoked_at IS NULL
        AND bat.expires_at > NOW()
    )
  );

-- booking_audit_log: append-only CUSTOMER INSERT for authorized booking only; NO SELECT / UPDATE / DELETE
DROP POLICY IF EXISTS booking_audit_log_public_flow_insert ON booking_audit_log;
CREATE POLICY booking_audit_log_public_flow_insert ON booking_audit_log
  FOR INSERT
  WITH CHECK (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND NULLIF(current_workcraft_salon_id(), '') IS NOT NULL
    AND salon_id = current_workcraft_salon_id()
    AND actor_type = 'CUSTOMER'
    AND action IN ('CREATED', 'RESCHEDULED', 'CANCELED')
    AND (
      (
        NULLIF(current_workcraft_booking_id(), '') IS NOT NULL
        AND booking_id::text = current_workcraft_booking_id()
      )
      OR (
        NULLIF(current_workcraft_token_hash(), '') IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM booking_access_tokens bat
          WHERE bat.booking_id = booking_audit_log.booking_id
            AND bat.salon_id = current_workcraft_salon_id()
            AND bat.token_hash = current_workcraft_token_hash()
            AND bat.revoked_at IS NULL
            AND bat.expires_at > NOW()
        )
      )
    )
  );

-- booking_access_tokens: PUBLIC_FLOW restricted strictly to exact token_hash & booking_id; NO DELETE
DROP POLICY IF EXISTS booking_access_tokens_public_flow_select ON booking_access_tokens;
CREATE POLICY booking_access_tokens_public_flow_select ON booking_access_tokens
  FOR SELECT
  USING (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND NULLIF(current_workcraft_salon_id(), '') IS NOT NULL
    AND salon_id = current_workcraft_salon_id()
    AND NULLIF(current_workcraft_token_hash(), '') IS NOT NULL
    AND token_hash = current_workcraft_token_hash()
    AND revoked_at IS NULL
    AND expires_at > NOW()
  );

DROP POLICY IF EXISTS booking_access_tokens_public_flow_insert ON booking_access_tokens;
CREATE POLICY booking_access_tokens_public_flow_insert ON booking_access_tokens
  FOR INSERT
  WITH CHECK (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND NULLIF(current_workcraft_salon_id(), '') IS NOT NULL
    AND salon_id = current_workcraft_salon_id()
    AND NULLIF(current_workcraft_token_hash(), '') IS NOT NULL
    AND token_hash = current_workcraft_token_hash()
    AND NULLIF(current_workcraft_booking_id(), '') IS NOT NULL
    AND booking_id::text = current_workcraft_booking_id()
    AND revoked_at IS NULL
    AND expires_at > NOW()
    AND EXISTS (
      SELECT 1
      FROM bookings b
      WHERE b.id = booking_access_tokens.booking_id
        AND b.salon_id = current_workcraft_salon_id()
        AND b.status IN ('CONFIRMED', 'IN_CHAIR')
    )
  );

DROP POLICY IF EXISTS booking_access_tokens_public_flow_update ON booking_access_tokens;
CREATE POLICY booking_access_tokens_public_flow_update ON booking_access_tokens
  FOR UPDATE
  USING (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND NULLIF(current_workcraft_salon_id(), '') IS NOT NULL
    AND salon_id = current_workcraft_salon_id()
    AND NULLIF(current_workcraft_token_hash(), '') IS NOT NULL
    AND token_hash = current_workcraft_token_hash()
    AND revoked_at IS NULL
    AND expires_at > NOW()
  )
  WITH CHECK (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND NULLIF(current_workcraft_salon_id(), '') IS NOT NULL
    AND salon_id = current_workcraft_salon_id()
    AND NULLIF(current_workcraft_token_hash(), '') IS NOT NULL
    AND token_hash = current_workcraft_token_hash()
    AND revoked_at IS NULL
    AND expires_at > NOW()
  );

-- salon_usage_monthly: ZERO direct PUBLIC_FLOW access (increments must go through increment_salon_monthly_booking_usage)
DROP POLICY IF EXISTS salon_usage_monthly_public_flow_select ON salon_usage_monthly;
DROP POLICY IF EXISTS salon_usage_monthly_public_flow_insert ON salon_usage_monthly;
DROP POLICY IF EXISTS salon_usage_monthly_public_flow_update ON salon_usage_monthly;

-- counter_notifications: PUBLIC_FLOW INSERT restricted to authorized booking only; NO SELECT / UPDATE / DELETE
DROP POLICY IF EXISTS counter_notifications_public_flow_insert ON counter_notifications;
CREATE POLICY counter_notifications_public_flow_insert ON counter_notifications
  FOR INSERT
  WITH CHECK (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND NULLIF(current_workcraft_salon_id(), '') IS NOT NULL
    AND salon_id = current_workcraft_salon_id()
    AND booking_id IS NOT NULL
    AND event_type IN ('NEW_BOOKING', 'RESCHEDULED', 'CANCELED')
    AND (
      (
        NULLIF(current_workcraft_booking_id(), '') IS NOT NULL
        AND booking_id::text = current_workcraft_booking_id()
      )
      OR (
        NULLIF(current_workcraft_token_hash(), '') IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM booking_access_tokens bat
          WHERE bat.booking_id = counter_notifications.booking_id
            AND bat.salon_id = current_workcraft_salon_id()
            AND bat.token_hash = current_workcraft_token_hash()
            AND bat.revoked_at IS NULL
            AND bat.expires_at > NOW()
        )
      )
    )
  );

-- Note: client_browser_tokens, marketing_consents, and reviews_log have NO demonstrated PUBLIC_FLOW SQL
-- queries in application code and therefore grant ZERO PUBLIC_FLOW table access (FOUNDER & SALON_OWNER only).

-- Agent scoped access for stylists of assigned salons only
DROP POLICY IF EXISTS stylists_agent_assigned ON stylists;
CREATE POLICY stylists_agent_assigned ON stylists
  FOR ALL
  USING (
    current_workcraft_role() = 'AGENT'
    AND NULLIF(current_workcraft_agent_id(), '') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM salons s
      WHERE s.id = stylists.salon_id
        AND s.assigned_agent_id = current_workcraft_agent_id()
    )
  )
  WITH CHECK (
    current_workcraft_role() = 'AGENT'
    AND NULLIF(current_workcraft_agent_id(), '') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM salons s
      WHERE s.id = stylists.salon_id
        AND s.assigned_agent_id = current_workcraft_agent_id()
    )
  );

-- service_stylists (join table): separate OWNER write vs PUBLIC_FLOW read-only (prevents PUBLIC_FLOW DELETE)
ALTER TABLE service_stylists ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_stylists FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_stylists_founder_all ON service_stylists;
CREATE POLICY service_stylists_founder_all ON service_stylists
  FOR ALL USING (current_workcraft_role() = 'FOUNDER') WITH CHECK (current_workcraft_role() = 'FOUNDER');

DROP POLICY IF EXISTS service_stylists_salon_scoped ON service_stylists;
DROP POLICY IF EXISTS service_stylists_owner_isolated ON service_stylists;
CREATE POLICY service_stylists_owner_isolated ON service_stylists
  FOR ALL
  USING (
    current_workcraft_role() = 'SALON_OWNER'
    AND NULLIF(current_workcraft_salon_id(), '') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM stylists st
      WHERE st.id = service_stylists.stylist_id
        AND st.salon_id = current_workcraft_salon_id()
    )
  )
  WITH CHECK (
    current_workcraft_role() = 'SALON_OWNER'
    AND NULLIF(current_workcraft_salon_id(), '') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM stylists st
      WHERE st.id = service_stylists.stylist_id
        AND st.salon_id = current_workcraft_salon_id()
    )
  );

DROP POLICY IF EXISTS service_stylists_public_flow_select ON service_stylists;
CREATE POLICY service_stylists_public_flow_select ON service_stylists
  FOR SELECT
  USING (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND NULLIF(current_workcraft_salon_id(), '') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM stylists st
      WHERE st.id = service_stylists.stylist_id
        AND st.salon_id = current_workcraft_salon_id()
    )
  );

-- auth_challenges: strictly restricted to FOUNDER, authenticated challenge owner, or single scoped challenge GUC
ALTER TABLE auth_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_challenges FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auth_challenges_founder_all ON auth_challenges;
CREATE POLICY auth_challenges_founder_all ON auth_challenges
  FOR ALL
  USING (current_workcraft_role() = 'FOUNDER')
  WITH CHECK (current_workcraft_role() = 'FOUNDER');

DROP POLICY IF EXISTS auth_challenges_self_select ON auth_challenges;
CREATE POLICY auth_challenges_self_select ON auth_challenges
  FOR SELECT
  USING (
    current_workcraft_role() IN ('SALON_OWNER', 'AGENT')
    AND NULLIF(current_workcraft_user_id(), '') IS NOT NULL
    AND user_id IS NOT NULL
    AND user_id::text = current_workcraft_user_id()
    AND consumed_at IS NULL
    AND expires_at > NOW()
  );

DROP POLICY IF EXISTS auth_challenges_self_update ON auth_challenges;
CREATE POLICY auth_challenges_self_update ON auth_challenges
  FOR UPDATE
  USING (
    current_workcraft_role() IN ('SALON_OWNER', 'AGENT')
    AND NULLIF(current_workcraft_user_id(), '') IS NOT NULL
    AND user_id IS NOT NULL
    AND user_id::text = current_workcraft_user_id()
    AND consumed_at IS NULL
    AND expires_at > NOW()
    AND attempts < 5
  )
  WITH CHECK (
    current_workcraft_role() IN ('SALON_OWNER', 'AGENT')
    AND NULLIF(current_workcraft_user_id(), '') IS NOT NULL
    AND user_id IS NOT NULL
    AND user_id::text = current_workcraft_user_id()
    AND attempts <= 5
  );

DROP POLICY IF EXISTS auth_challenges_public_client_insert ON auth_challenges;
CREATE POLICY auth_challenges_public_client_insert ON auth_challenges
  FOR INSERT
  WITH CHECK (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND purpose = 'CROSS_DEVICE_CLIENT'
    AND user_id IS NULL
    AND consumed_at IS NULL
    AND attempts = 0
    AND expires_at > NOW()
    AND expires_at <= NOW() + INTERVAL '30 minutes'
  );

DROP POLICY IF EXISTS auth_challenges_public_client_select ON auth_challenges;
CREATE POLICY auth_challenges_public_client_select ON auth_challenges
  FOR SELECT
  USING (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND purpose = 'CROSS_DEVICE_CLIENT'
    AND NULLIF(current_workcraft_challenge_id(), '') IS NOT NULL
    AND id::text = current_workcraft_challenge_id()
    AND consumed_at IS NULL
    AND expires_at > NOW()
  );

DROP POLICY IF EXISTS auth_challenges_public_client_update ON auth_challenges;
CREATE POLICY auth_challenges_public_client_update ON auth_challenges
  FOR UPDATE
  USING (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND purpose = 'CROSS_DEVICE_CLIENT'
    AND NULLIF(current_workcraft_challenge_id(), '') IS NOT NULL
    AND id::text = current_workcraft_challenge_id()
    AND consumed_at IS NULL
    AND expires_at > NOW()
    AND attempts < 5
  )
  WITH CHECK (
    current_workcraft_role() = 'PUBLIC_FLOW'
    AND purpose = 'CROSS_DEVICE_CLIENT'
    AND NULLIF(current_workcraft_challenge_id(), '') IS NOT NULL
    AND id::text = current_workcraft_challenge_id()
    AND attempts <= 5
  );

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
  FOR SELECT USING (
    current_workcraft_role() = 'AGENT'
    AND NULLIF(current_workcraft_agent_id(), '') IS NOT NULL
    AND agent_id = current_workcraft_agent_id()
  );

-- payment_submissions (Founder manages all; Agent reads/inserts own submissions; Owner reads/inserts own salon)
ALTER TABLE payment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_submissions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_submissions_founder_all ON payment_submissions;
CREATE POLICY payment_submissions_founder_all ON payment_submissions
  FOR ALL USING (current_workcraft_role() = 'FOUNDER') WITH CHECK (current_workcraft_role() = 'FOUNDER');
DROP POLICY IF EXISTS payment_submissions_agent_scoped ON payment_submissions;
CREATE POLICY payment_submissions_agent_scoped ON payment_submissions
  FOR SELECT USING (
    current_workcraft_role() = 'AGENT'
    AND NULLIF(current_workcraft_agent_id(), '') IS NOT NULL
    AND agent_id = current_workcraft_agent_id()
  );
DROP POLICY IF EXISTS payment_submissions_agent_insert ON payment_submissions;
CREATE POLICY payment_submissions_agent_insert ON payment_submissions
  FOR INSERT WITH CHECK (
    current_workcraft_role() = 'AGENT'
    AND NULLIF(current_workcraft_agent_id(), '') IS NOT NULL
    AND agent_id = current_workcraft_agent_id()
    AND submitted_by_role = 'AGENT'
    AND status = 'PENDING_REVIEW'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );
DROP POLICY IF EXISTS payment_submissions_owner_scoped ON payment_submissions;
CREATE POLICY payment_submissions_owner_scoped ON payment_submissions
  FOR SELECT USING (
    current_workcraft_role() = 'SALON_OWNER'
    AND NULLIF(current_workcraft_salon_id(), '') IS NOT NULL
    AND salon_id = current_workcraft_salon_id()
  );
DROP POLICY IF EXISTS payment_submissions_owner_insert ON payment_submissions;
CREATE POLICY payment_submissions_owner_insert ON payment_submissions
  FOR INSERT WITH CHECK (
    current_workcraft_role() = 'SALON_OWNER'
    AND NULLIF(current_workcraft_salon_id(), '') IS NOT NULL
    AND salon_id = current_workcraft_salon_id()
    AND submitted_by_role = 'SALON_OWNER'
    AND status = 'PENDING_REVIEW'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );

-- cash_custody_ledger & commission_ledger (Founder all; Agent scoped read own)
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
      'CREATE POLICY %I ON %I FOR SELECT USING (current_workcraft_role() = ''AGENT'' AND NULLIF(current_workcraft_agent_id(), '''') IS NOT NULL AND agent_id = current_workcraft_agent_id())',
      tbl || '_agent_select',
      tbl
    );
  END LOOP;
END $$;

COMMIT;
