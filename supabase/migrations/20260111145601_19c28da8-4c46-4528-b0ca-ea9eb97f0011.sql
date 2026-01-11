-- Harden protect_paid_invoice: REMOVE postgres from allowlist
-- Only service_role members can bypass

CREATE OR REPLACE FUNCTION public.protect_paid_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bypass TEXT;
  v_is_server_context BOOLEAN := FALSE;
BEGIN
  -- Allow INSERT without restriction
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Only protect invoices with status = 'paid'
  IF OLD.status <> 'paid' THEN
    RETURN NEW;
  END IF;

  -- Check for internal reconciliation bypass flag
  v_bypass := current_setting('app.internal_reconcile', true);

  -- SECURITY: Server context detection using session_user ONLY
  -- DECISION: postgres NOT ALLOWED (removed from allowlist)
  -- DECISION: service_role ONLY allowed for edge functions/webhooks
  v_is_server_context := (
    EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
    AND pg_has_role(session_user, 'service_role', 'member')
  );

  -- Bypass allowed only in verified server context
  IF v_bypass = '1' AND v_is_server_context THEN
    RETURN NEW;
  END IF;

  -- Unauthorized bypass attempt
  IF v_bypass = '1' AND NOT v_is_server_context THEN
    RAISE WARNING '[SECURITY] Unauthorized bypass attempt on paid invoice % by session_user=%', OLD.id, session_user;
    RAISE EXCEPTION '[IMMUTABILITY] Paid invoice % cannot be modified', OLD.id;
  END IF;

  -- Block all other modifications to paid invoices
  RAISE EXCEPTION '[IMMUTABILITY] Paid invoice % cannot be modified', OLD.id;
END;
$$;

COMMENT ON FUNCTION public.protect_paid_invoice() IS
'Protects paid invoices from modification. Bypass via app.internal_reconcile=1 is allowed ONLY for service_role members. postgres user is NOT allowed to bypass.';