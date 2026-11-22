-- =============================================================================
-- WORKCRAFT Local — Web-First Production PostgreSQL Migration
-- Migration: 002_web_first_production.sql
--
-- Architecture:
--   * Managed PostgreSQL primary source of truth (zero ephemeral JSON/tmp)
--   * Unguessable public_code per salon (replaces enumerable numeric IDs)
--   * Separated owner auth phone, public contact phone, optional WhatsApp phone
--   * Transactional booking exclusion constraint (btree_gist) preventing stylist overlaps
--   * Idempotency keys, booking audit log, revocable access tokens, monthly usage meter
--   * Neutral unfiltered post-completion Google reviews & separate marketing consent
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- -----------------------------------------------------------------------------
-- 1. Core Tenants (Salons) & Separated Auth / Memberships
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS salons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_code TEXT NOT NULL UNIQUE,
  salon_name TEXT NOT NULL,
  salon_category TEXT NOT NULL DEFAULT 'MENS' CHECK (salon_category IN ('MENS', 'LADIES')),
  owner_auth_phone TEXT NOT NULL,
  public_contact_phone TEXT NOT NULL,
  public_whatsapp_phone TEXT,
  country_code TEXT NOT NULL DEFAULT 'PK',
  timezone_iana TEXT NOT NULL DEFAULT 'Asia/Karachi',
  timezone_offset_hours NUMERIC(4,2) NOT NULL DEFAULT 5,
  currency_code TEXT NOT NULL DEFAULT 'PKR',
  currency_symbol TEXT NOT NULL DEFAULT 'PKR ',
  default_lang TEXT NOT NULL DEFAULT 'en' CHECK (default_lang IN ('en', 'roman_ur', 'ur', 'ar')),
  enabled_langs TEXT[] NOT NULL DEFAULT ARRAY['en', 'roman_ur', 'ur']::TEXT[],
  plan_tier TEXT NOT NULL DEFAULT 'STARTER' CHECK (plan_tier IN ('STARTER', 'PRO', 'PRO++', 'CUSTOM')),
  monthly_booking_limit INTEGER NOT NULL DEFAULT 750 CHECK (monthly_booking_limit > 0),
  grace_overage_limit INTEGER NOT NULL DEFAULT 50 CHECK (grace_overage_limit >= 0),
  billing_status TEXT NOT NULL DEFAULT 'PENDING_ACTIVATION'
    CHECK (billing_status IN ('PENDING_ACTIVATION', 'ACTIVE', 'PAST_DUE', 'SUSPENDED')),
  whatsapp_addon_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  meta_phone_number_id TEXT UNIQUE,
  assigned_agent_id TEXT,
  operating_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  address TEXT NOT NULL DEFAULT '',
  google_maps_url TEXT NOT NULL DEFAULT '',
  google_review_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('FOUNDER', 'AGENT', 'SALON_OWNER')),
  display_name TEXT NOT NULL,
  email TEXT UNIQUE,
  auth_phone TEXT UNIQUE,
  agent_id TEXT,
  session_version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salon_memberships (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'MANAGER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, salon_id)
);

CREATE TABLE IF NOT EXISTS auth_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_phone TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('OWNER_LOGIN', 'CROSS_DEVICE_CLIENT')),
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. Services, Stylists, Eligibility & Leaves / Chair Locks
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  duration_mins INTEGER NOT NULL DEFAULT 35 CHECK (duration_mins BETWEEN 5 AND 480),
  buffer_after_mins INTEGER NOT NULL DEFAULT 0 CHECK (buffer_after_mins BETWEEN 0 AND 120),
  price INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
  translations JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stylists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  chair_label TEXT NOT NULL DEFAULT 'Chair 1',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (salon_id, name)
);

CREATE TABLE IF NOT EXISTS service_stylists (
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  stylist_id UUID NOT NULL REFERENCES stylists(id) ON DELETE CASCADE,
  PRIMARY KEY (service_id, stylist_id)
);

CREATE TABLE IF NOT EXISTS stylist_leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  stylist_id UUID NOT NULL REFERENCES stylists(id) ON DELETE CASCADE,
  lock_type TEXT NOT NULL DEFAULT 'CHAIR_LOCK' CHECK (lock_type IN ('CHAIR_LOCK', 'LEAVE', 'BREAK')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

-- -----------------------------------------------------------------------------
-- 3. Privacy-Isolated Clients, Browser Recognition & Marketing Consent
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone_e164 TEXT NOT NULL,
  preferred_lang TEXT NOT NULL DEFAULT 'en' CHECK (preferred_lang IN ('en', 'roman_ur', 'ur', 'ar')),
  birth_day_month TEXT NOT NULL DEFAULT '',
  total_visits INTEGER NOT NULL DEFAULT 0,
  last_service_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  last_stylist_id UUID REFERENCES stylists(id) ON DELETE SET NULL,
  last_completed_visit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (salon_id, phone_e164)
);

CREATE TABLE IF NOT EXISTS client_browser_tokens (
  token_hash TEXT PRIMARY KEY,
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketing_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  opted_in BOOLEAN NOT NULL DEFAULT FALSE,
  consent_source TEXT NOT NULL DEFAULT 'WEB_BOOKING',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (salon_id, client_id)
);

-- -----------------------------------------------------------------------------
-- 4. Deals (FB / IG / TikTok Local Ad Landing Pages — No Video Blasts)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  ad_channel TEXT NOT NULL DEFAULT 'DIRECT' CHECK (ad_channel IN ('FB', 'IG', 'TIKTOK', 'DIRECT')),
  discount_type TEXT NOT NULL DEFAULT 'PCT' CHECK (discount_type IN ('PCT', 'FIXED', 'BUNDLE_PRICE')),
  discount_value INTEGER NOT NULL DEFAULT 15 CHECK (discount_value >= 0),
  service_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 5. Transactional Bookings, Audit Log, Access Tokens & Monthly Quota Meter
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
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
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
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
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salon_usage_monthly (
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  billing_month TEXT NOT NULL,
  billable_bookings INTEGER NOT NULL DEFAULT 0 CHECK (billable_bookings >= 0),
  overage_bookings INTEGER NOT NULL DEFAULT 0 CHECK (overage_bookings >= 0),
  limit_snapshot INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (salon_id, billing_month)
);

-- Unfiltered post-completion review invitation log
CREATE TABLE IF NOT EXISTS reviews_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  review_url TEXT NOT NULL,
  invitation_shown_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clicked_at TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- 6. Row-Level Tenant Isolation Policies
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'services', 'stylists', 'stylist_leaves', 'clients',
      'client_browser_tokens', 'marketing_consents', 'deals',
      'bookings', 'booking_audit_log', 'booking_access_tokens',
      'salon_usage_monthly', 'reviews_log'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_tenant_isolation', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (current_setting(''app.current_role'', true) = ''FOUNDER'' OR salon_id = NULLIF(current_setting(''app.current_salon_id'', true), '''')::uuid)',
      tbl || '_tenant_isolation',
      tbl
    );
  END LOOP;
END $$;

COMMIT;
