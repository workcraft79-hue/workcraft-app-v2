-- Phase 0B: make PostgreSQL RLS identity claims cryptographically verifiable.
-- The signing key is provisioned separately and is never committed to source control.
-- Until an active key is provisioned and PG_ACTOR_CONTEXT_SECRET is configured in the
-- trusted server runtime, the verifier returns NULL and RLS identity helpers fail closed.

CREATE SCHEMA IF NOT EXISTS workcraft_private;
REVOKE ALL ON SCHEMA workcraft_private FROM PUBLIC;

CREATE TABLE IF NOT EXISTS workcraft_private.actor_signing_keys (
  key_id text PRIMARY KEY,
  key_material bytea NOT NULL CHECK (octet_length(key_material) >= 32),
  active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE UNIQUE INDEX IF NOT EXISTS actor_signing_keys_one_active
  ON workcraft_private.actor_signing_keys (active)
  WHERE active IS TRUE;

REVOKE ALL ON TABLE workcraft_private.actor_signing_keys FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.current_workcraft_actor_claims()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'workcraft_private', 'pg_temp'
AS $function$
DECLARE
  v_payload text;
  v_signature text;
  v_claims jsonb;
  v_key bytea;
  v_now bigint;
  v_iat bigint;
  v_exp bigint;
  v_role text;
BEGIN
  v_payload := NULLIF(pg_catalog.current_setting('app.actor_context_payload', TRUE), '');
  v_signature := NULLIF(pg_catalog.current_setting('app.actor_context_signature', TRUE), '');

  IF v_payload IS NULL OR pg_catalog.length(v_payload) > 4096
     OR v_signature IS NULL OR v_signature !~ '^[0-9a-f]{64}$' THEN
    RETURN NULL;
  END IF;

  v_claims := v_payload::jsonb;
  IF jsonb_typeof(v_claims) <> 'object' OR v_claims->>'v' IS DISTINCT FROM '1'
     OR NULLIF(v_claims->>'kid', '') IS NULL
     OR (v_claims->>'iat') !~ '^[0-9]{1,12}$'
     OR (v_claims->>'exp') !~ '^[0-9]{1,12}$'
     OR NULLIF(v_claims->>'nonce', '') IS NULL THEN
    RETURN NULL;
  END IF;

  v_iat := (v_claims->>'iat')::bigint;
  v_exp := (v_claims->>'exp')::bigint;
  v_now := pg_catalog.floor(extract(epoch FROM pg_catalog.clock_timestamp()))::bigint;

  IF v_iat > v_now + 30 OR v_exp <= v_now OR v_exp <= v_iat OR v_exp - v_iat > 900 THEN
    RETURN NULL;
  END IF;

  v_role := v_claims->>'role';
  IF v_role NOT IN ('FOUNDER', 'SALON_OWNER', 'AGENT', 'PUBLIC_FLOW') THEN
    RETURN NULL;
  END IF;

  IF v_role = 'FOUNDER' AND (
       NULLIF(v_claims->>'userId', '') IS NULL
       OR NULLIF(v_claims->>'salonId', '') IS NOT NULL
       OR NULLIF(v_claims->>'agentId', '') IS NOT NULL
     ) THEN RETURN NULL; END IF;

  IF v_role = 'SALON_OWNER' AND (
       NULLIF(v_claims->>'userId', '') IS NULL
       OR NULLIF(v_claims->>'salonId', '') IS NULL
       OR NULLIF(v_claims->>'agentId', '') IS NOT NULL
     ) THEN RETURN NULL; END IF;

  IF v_role = 'AGENT' AND (
       NULLIF(v_claims->>'userId', '') IS NULL
       OR NULLIF(v_claims->>'agentId', '') IS NULL
       OR NULLIF(v_claims->>'salonId', '') IS NOT NULL
     ) THEN RETURN NULL; END IF;

  IF v_role = 'PUBLIC_FLOW' AND (
       NULLIF(v_claims->>'userId', '') IS NOT NULL
       OR NULLIF(v_claims->>'agentId', '') IS NOT NULL
     ) THEN RETURN NULL; END IF;

  SELECT key_material
    INTO v_key
  FROM workcraft_private.actor_signing_keys
  WHERE key_id = v_claims->>'kid'
    AND active IS TRUE
  LIMIT 1;

  IF v_key IS NULL THEN
    RETURN NULL;
  END IF;

  IF public.hmac(pg_catalog.convert_to(v_payload, 'UTF8'), v_key, 'sha256')
       <> pg_catalog.decode(v_signature, 'hex') THEN
    RETURN NULL;
  END IF;

  RETURN v_claims;
EXCEPTION
  WHEN OTHERS THEN
    -- Malformed or unverifiable context must never grant database access.
    RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.current_workcraft_actor_claims() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_workcraft_actor_claims() TO PUBLIC;

CREATE OR REPLACE FUNCTION public.current_workcraft_role()
RETURNS text LANGUAGE sql VOLATILE
AS $function$
  SELECT COALESCE(public.current_workcraft_actor_claims()->>'role', '');
$function$;

CREATE OR REPLACE FUNCTION public.current_workcraft_salon_id()
RETURNS text LANGUAGE sql VOLATILE
AS $function$
  SELECT COALESCE(public.current_workcraft_actor_claims()->>'salonId', '');
$function$;

CREATE OR REPLACE FUNCTION public.current_workcraft_agent_id()
RETURNS text LANGUAGE sql VOLATILE
AS $function$
  SELECT COALESCE(public.current_workcraft_actor_claims()->>'agentId', '');
$function$;

CREATE OR REPLACE FUNCTION public.current_workcraft_user_id()
RETURNS text LANGUAGE sql VOLATILE
AS $function$
  SELECT COALESCE(public.current_workcraft_actor_claims()->>'userId', '');
$function$;

CREATE OR REPLACE FUNCTION public.current_workcraft_public_code()
RETURNS text LANGUAGE sql VOLATILE
AS $function$
  SELECT COALESCE(public.current_workcraft_actor_claims()->>'publicCode', '');
$function$;

CREATE OR REPLACE FUNCTION public.current_workcraft_token_hash()
RETURNS text LANGUAGE sql VOLATILE
AS $function$
  SELECT COALESCE(public.current_workcraft_actor_claims()->>'tokenHash', '');
$function$;

CREATE OR REPLACE FUNCTION public.current_workcraft_booking_id()
RETURNS text LANGUAGE sql VOLATILE
AS $function$
  SELECT COALESCE(public.current_workcraft_actor_claims()->>'bookingId', '');
$function$;

CREATE OR REPLACE FUNCTION public.current_workcraft_client_id()
RETURNS text LANGUAGE sql VOLATILE
AS $function$
  SELECT COALESCE(public.current_workcraft_actor_claims()->>'clientId', '');
$function$;

CREATE OR REPLACE FUNCTION public.current_workcraft_idempotency_key()
RETURNS text LANGUAGE sql VOLATILE
AS $function$
  SELECT COALESCE(public.current_workcraft_actor_claims()->>'idempotencyKey', '');
$function$;

CREATE OR REPLACE FUNCTION public.current_workcraft_challenge_id()
RETURNS text LANGUAGE sql VOLATILE
AS $function$
  SELECT COALESCE(public.current_workcraft_actor_claims()->>'challengeId', '');
$function$;
