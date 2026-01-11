-- Switch to SECURITY INVOKER and use current_user for bypass detection
-- This ensures bypass works ONLY when invoker role is service_role

CREATE OR REPLACE FUNCTION public.protect_paid_invoice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_bypass text;
  v_is_server_context boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF OLD.status <> 'paid' THEN
    RETURN NEW;
  END IF;

  v_bypass := current_setting('app.internal_reconcile', true);

  v_is_server_context := (
    EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
    AND pg_has_role(current_user, 'service_role', 'member')
  );

  IF v_bypass = '1' AND v_is_server_context THEN
    RETURN NEW;
  END IF;

  IF v_bypass = '1' AND NOT v_is_server_context THEN
    RAISE WARNING '[SECURITY] Unauthorized bypass attempt on paid invoice % by session_user=%, current_user=%',
      OLD.id, session_user, current_user;
    RAISE EXCEPTION '[IMMUTABILITY] Paid invoice % cannot be modified', OLD.id;
  END IF;

  RAISE EXCEPTION '[IMMUTABILITY] Paid invoice % cannot be modified', OLD.id;
END;
$$;

COMMENT ON FUNCTION public.protect_paid_invoice() IS
'Paid invoice immutability. Bypass (app.internal_reconcile=1) is honored ONLY when invoker role is service_role (checked via current_user + pg_has_role). No session_user allowlist.';