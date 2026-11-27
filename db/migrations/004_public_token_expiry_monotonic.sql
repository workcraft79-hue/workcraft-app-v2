-- Phase 0B security follow-up: public booking access tokens may only be extended.
-- Existing token identity/scope fields remain immutable under PUBLIC_FLOW.
CREATE OR REPLACE FUNCTION public.guard_booking_access_tokens_public_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
BEGIN
  IF public.current_workcraft_role() <> 'PUBLIC_FLOW' THEN
    RETURN NEW;
  END IF;

  IF (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW.token_hash IS DISTINCT FROM OLD.token_hash
    OR NEW.booking_id IS DISTINCT FROM OLD.booking_id
    OR NEW.salon_id IS DISTINCT FROM OLD.salon_id
    OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.expires_at IS NULL
    OR NEW.expires_at <= OLD.expires_at
    OR NEW.expires_at <= pg_catalog.now()
    OR NEW.expires_at > pg_catalog.now() + INTERVAL '365 days'
  ) THEN
    RAISE EXCEPTION 'PUBLIC_FLOW may only extend expires_at on its verified active booking access token';
  END IF;

  RETURN NEW;
END;
$function$;
