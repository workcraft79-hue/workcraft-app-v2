-- =============================================================================
-- WORKCRAFT Local — Production PostgreSQL Schema & Row-Level Security (RLS)
-- Migration: 001_production_rls.sql
--
-- Tenant & Role Isolation Model:
--   * FOUNDER     : Full read/admin access across all tenants & users.
--   * AGENT       : Can only view/create salons assigned to their agent_id
--                   (plus initial barber/service onboarding setup for those salons).
--   * SALON_OWNER : Strictly scoped to SELECT, INSERT, UPDATE, DELETE rows
--                   matching their own verified salon_id only.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workcraft_role') THEN
    CREATE TYPE workcraft_role AS ENUM ('FOUNDER', 'AGENT', 'SALON_OWNER');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. Core Tenant & Authentication Tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS salons (
  id TEXT PRIMARY KEY,
  salon_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  whatsapp_phone TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT '+92',
  timezone_offset_hours INTEGER NOT NULL DEFAULT 5,
  currency TEXT NOT NULL DEFAULT 'PKR',
  currency_symbol TEXT NOT NULL DEFAULT 'PKR ',
  package_tier TEXT NOT NULL DEFAULT 'PRO++' CHECK (package_tier IN ('STARTER', 'PRO', 'PRO++')),
  assigned_agent_id TEXT,
  counter_slept_at TIMESTAMPTZ,
  birthday_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  birthday_discount_pct INTEGER NOT NULL DEFAULT 20 CHECK (birthday_discount_pct BETWEEN 0 AND 100),
  birthday_fixed_discount INTEGER NOT NULL DEFAULT 500 CHECK (birthday_fixed_discount >= 0),
  birthday_gift_service TEXT NOT NULL DEFAULT '',
  birthday_message_template TEXT NOT NULL DEFAULT '',
  winback_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  winback_days INTEGER NOT NULL DEFAULT 30 CHECK (winback_days BETWEEN 1 AND 365),
  winback_discount_pct INTEGER NOT NULL DEFAULT 15 CHECK (winback_discount_pct BETWEEN 0 AND 100),
  winback_addon_service TEXT NOT NULL DEFAULT '',
  winback_message_template TEXT NOT NULL DEFAULT '',
  review_booster_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  google_review_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  display_name TEXT NOT NULL,
  user_role workcraft_role NOT NULL,
  salon_id TEXT REFERENCES salons(id) ON DELETE SET NULL,
  agent_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_user_role_binding CHECK (
    (user_role = 'FOUNDER' AND salon_id IS NULL AND agent_id IS NULL) OR
    (user_role = 'AGENT' AND agent_id IS NOT NULL AND salon_id IS NULL) OR
    (user_role = 'SALON_OWNER' AND salon_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS barbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  chair_label TEXT NOT NULL DEFAULT 'Chair 1',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (salon_id, name)
);

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  duration_mins INTEGER NOT NULL DEFAULT 30 CHECK (duration_mins BETWEEN 5 AND 480),
  translations JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  preferred_language TEXT CHECK (preferred_language IN ('en', 'roman_ur', 'ur', 'ar')),
  awaiting_language_selection BOOLEAN NOT NULL DEFAULT TRUE,
  birth_date TEXT NOT NULL DEFAULT '',
  last_completed_visit_at TIMESTAMPTZ,
  last_birthday_sent_year INTEGER,
  last_winback_sent_at TIMESTAMPTZ,
  awaiting_winback_rebook BOOLEAN NOT NULL DEFAULT FALSE,
  awaiting_review_appointment_id TEXT,
  pending_reroute JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (salon_id, phone)
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  barber_id UUID REFERENCES barbers(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  barber_name TEXT NOT NULL,
  service TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
  time_slot TEXT NOT NULL,
  duration_mins INTEGER NOT NULL DEFAULT 35,
  scheduled_end_ms BIGINT,
  flagged BOOLEAN NOT NULL DEFAULT FALSE,
  canceled BOOLEAN NOT NULL DEFAULT FALSE,
  source_type TEXT NOT NULL DEFAULT 'WHATSAPP_BOT' CHECK (source_type IN ('WHATSAPP_BOT', 'WALK_IN_BUSY')),
  status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'IN_CHAIR', 'COMPLETED')),
  scheduled_for_iso TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  review_prompt_sent_at TIMESTAMPTZ,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  rating_comment TEXT,
  review_routed_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (review_routed_status IN ('PENDING', 'PROMPT_SENT', 'PUBLIC_GOOGLE_SENT', 'OWNER_INTERVENTION_NEEDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id TEXT PRIMARY KEY,
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
  module TEXT NOT NULL CHECK (module IN ('LANGUAGE_MENU', 'BIRTHDAY_9AM', 'WINBACK_30D', 'REVIEW_T2H', 'BOOKING')),
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('en', 'roman_ur', 'ur', 'ar')),
  dir TEXT NOT NULL CHECK (dir IN ('ltr', 'rtl')),
  body TEXT NOT NULL,
  event_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  salon_id TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  service TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OWNER_INTERVENTION_NEEDED'
    CHECK (status IN ('OWNER_INTERVENTION_NEEDED', 'RESOLVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_salons_agent ON salons (assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_barbers_salon ON barbers (salon_id);
CREATE INDEX IF NOT EXISTS idx_services_salon ON services (salon_id);
CREATE INDEX IF NOT EXISTS idx_clients_salon ON clients (salon_id);
CREATE INDEX IF NOT EXISTS idx_appointments_salon ON appointments (salon_id, status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_salon ON whatsapp_messages (salon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_salon_status ON alerts (salon_id, status);

-- -----------------------------------------------------------------------------
-- 2. Verified Session / JWT Claim Helpers
-- Supports both Express transaction-local GUC settings (SET LOCAL app.current_*)
-- and standard Postgres / PostgREST JWT claims (request.jwt.claims).
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
-- 3. Enable & Force Row-Level Security (RLS) on All Tables
-- -----------------------------------------------------------------------------

ALTER TABLE app_users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE salons            ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE services          ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts            ENABLE ROW LEVEL SECURITY;

ALTER TABLE app_users         FORCE ROW LEVEL SECURITY;
ALTER TABLE salons            FORCE ROW LEVEL SECURITY;
ALTER TABLE barbers           FORCE ROW LEVEL SECURITY;
ALTER TABLE services          FORCE ROW LEVEL SECURITY;
ALTER TABLE appointments      FORCE ROW LEVEL SECURITY;
ALTER TABLE clients           FORCE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE alerts            FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 4. Tenant Isolation Policies
-- -----------------------------------------------------------------------------

-- === APP_USERS ===
DROP POLICY IF EXISTS app_users_founder_all ON app_users;
CREATE POLICY app_users_founder_all ON app_users
  FOR ALL
  USING (current_workcraft_role() = 'FOUNDER')
  WITH CHECK (current_workcraft_role() = 'FOUNDER');

DROP POLICY IF EXISTS app_users_self_select ON app_users;
CREATE POLICY app_users_self_select ON app_users
  FOR SELECT
  USING (id::text = current_workcraft_user_id());

-- === SALONS ===
DROP POLICY IF EXISTS salons_founder_all ON salons;
CREATE POLICY salons_founder_all ON salons
  FOR ALL
  USING (current_workcraft_role() = 'FOUNDER')
  WITH CHECK (current_workcraft_role() = 'FOUNDER');

DROP POLICY IF EXISTS salons_owner_isolated ON salons;
CREATE POLICY salons_owner_isolated ON salons
  FOR ALL
  USING (
    current_workcraft_role() = 'SALON_OWNER'
    AND id = current_workcraft_salon_id()
  )
  WITH CHECK (
    current_workcraft_role() = 'SALON_OWNER'
    AND id = current_workcraft_salon_id()
  );

DROP POLICY IF EXISTS salons_agent_select ON salons;
CREATE POLICY salons_agent_select ON salons
  FOR SELECT
  USING (
    current_workcraft_role() = 'AGENT'
    AND assigned_agent_id = current_workcraft_agent_id()
  );

DROP POLICY IF EXISTS salons_agent_insert ON salons;
CREATE POLICY salons_agent_insert ON salons
  FOR INSERT
  WITH CHECK (
    current_workcraft_role() = 'AGENT'
    AND assigned_agent_id = current_workcraft_agent_id()
  );

-- === BARBERS ===
DROP POLICY IF EXISTS barbers_founder_all ON barbers;
CREATE POLICY barbers_founder_all ON barbers
  FOR ALL
  USING (current_workcraft_role() = 'FOUNDER')
  WITH CHECK (current_workcraft_role() = 'FOUNDER');

DROP POLICY IF EXISTS barbers_owner_isolated ON barbers;
CREATE POLICY barbers_owner_isolated ON barbers
  FOR ALL
  USING (
    current_workcraft_role() = 'SALON_OWNER'
    AND salon_id = current_workcraft_salon_id()
  )
  WITH CHECK (
    current_workcraft_role() = 'SALON_OWNER'
    AND salon_id = current_workcraft_salon_id()
  );

DROP POLICY IF EXISTS barbers_agent_assigned_salon ON barbers;
CREATE POLICY barbers_agent_assigned_salon ON barbers
  FOR SELECT
  USING (
    current_workcraft_role() = 'AGENT'
    AND EXISTS (
      SELECT 1 FROM salons s
      WHERE s.id = barbers.salon_id
        AND s.assigned_agent_id = current_workcraft_agent_id()
    )
  );

DROP POLICY IF EXISTS barbers_agent_insert_assigned_salon ON barbers;
CREATE POLICY barbers_agent_insert_assigned_salon ON barbers
  FOR INSERT
  WITH CHECK (
    current_workcraft_role() = 'AGENT'
    AND EXISTS (
      SELECT 1 FROM salons s
      WHERE s.id = barbers.salon_id
        AND s.assigned_agent_id = current_workcraft_agent_id()
    )
  );

-- === SERVICES ===
DROP POLICY IF EXISTS services_founder_all ON services;
CREATE POLICY services_founder_all ON services
  FOR ALL
  USING (current_workcraft_role() = 'FOUNDER')
  WITH CHECK (current_workcraft_role() = 'FOUNDER');

DROP POLICY IF EXISTS services_owner_isolated ON services;
CREATE POLICY services_owner_isolated ON services
  FOR ALL
  USING (
    current_workcraft_role() = 'SALON_OWNER'
    AND salon_id = current_workcraft_salon_id()
  )
  WITH CHECK (
    current_workcraft_role() = 'SALON_OWNER'
    AND salon_id = current_workcraft_salon_id()
  );

DROP POLICY IF EXISTS services_agent_assigned_salon ON services;
CREATE POLICY services_agent_assigned_salon ON services
  FOR SELECT
  USING (
    current_workcraft_role() = 'AGENT'
    AND EXISTS (
      SELECT 1 FROM salons s
      WHERE s.id = services.salon_id
        AND s.assigned_agent_id = current_workcraft_agent_id()
    )
  );

DROP POLICY IF EXISTS services_agent_insert_assigned_salon ON services;
CREATE POLICY services_agent_insert_assigned_salon ON services
  FOR INSERT
  WITH CHECK (
    current_workcraft_role() = 'AGENT'
    AND EXISTS (
      SELECT 1 FROM salons s
      WHERE s.id = services.salon_id
        AND s.assigned_agent_id = current_workcraft_agent_id()
    )
  );

-- === APPOINTMENTS (Strictly Owner & Founder only) ===
DROP POLICY IF EXISTS appointments_founder_all ON appointments;
CREATE POLICY appointments_founder_all ON appointments
  FOR ALL
  USING (current_workcraft_role() = 'FOUNDER')
  WITH CHECK (current_workcraft_role() = 'FOUNDER');

DROP POLICY IF EXISTS appointments_owner_isolated ON appointments;
CREATE POLICY appointments_owner_isolated ON appointments
  FOR ALL
  USING (
    current_workcraft_role() = 'SALON_OWNER'
    AND salon_id = current_workcraft_salon_id()
  )
  WITH CHECK (
    current_workcraft_role() = 'SALON_OWNER'
    AND salon_id = current_workcraft_salon_id()
  );

-- === CLIENTS (Strictly Owner & Founder only) ===
DROP POLICY IF EXISTS clients_founder_all ON clients;
CREATE POLICY clients_founder_all ON clients
  FOR ALL
  USING (current_workcraft_role() = 'FOUNDER')
  WITH CHECK (current_workcraft_role() = 'FOUNDER');

DROP POLICY IF EXISTS clients_owner_isolated ON clients;
CREATE POLICY clients_owner_isolated ON clients
  FOR ALL
  USING (
    current_workcraft_role() = 'SALON_OWNER'
    AND salon_id = current_workcraft_salon_id()
  )
  WITH CHECK (
    current_workcraft_role() = 'SALON_OWNER'
    AND salon_id = current_workcraft_salon_id()
  );

-- === WHATSAPP_MESSAGES (Strictly Owner & Founder only) ===
DROP POLICY IF EXISTS whatsapp_messages_founder_all ON whatsapp_messages;
CREATE POLICY whatsapp_messages_founder_all ON whatsapp_messages
  FOR ALL
  USING (current_workcraft_role() = 'FOUNDER')
  WITH CHECK (current_workcraft_role() = 'FOUNDER');

DROP POLICY IF EXISTS whatsapp_messages_owner_isolated ON whatsapp_messages;
CREATE POLICY whatsapp_messages_owner_isolated ON whatsapp_messages
  FOR ALL
  USING (
    current_workcraft_role() = 'SALON_OWNER'
    AND salon_id = current_workcraft_salon_id()
  )
  WITH CHECK (
    current_workcraft_role() = 'SALON_OWNER'
    AND salon_id = current_workcraft_salon_id()
  );

-- === ALERTS (Strictly Owner & Founder only) ===
DROP POLICY IF EXISTS alerts_founder_all ON alerts;
CREATE POLICY alerts_founder_all ON alerts
  FOR ALL
  USING (current_workcraft_role() = 'FOUNDER')
  WITH CHECK (current_workcraft_role() = 'FOUNDER');

DROP POLICY IF EXISTS alerts_owner_isolated ON alerts;
CREATE POLICY alerts_owner_isolated ON alerts
  FOR ALL
  USING (
    current_workcraft_role() = 'SALON_OWNER'
    AND salon_id = current_workcraft_salon_id()
  )
  WITH CHECK (
    current_workcraft_role() = 'SALON_OWNER'
    AND salon_id = current_workcraft_salon_id()
  );

COMMIT;
