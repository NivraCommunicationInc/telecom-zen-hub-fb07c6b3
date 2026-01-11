-- Harden protect_paid_invoice bypass detection (P0) - MINIMAL ALLOWLIST
-- Protège UNIQUEMENT le statut 'paid' (pas finalized qui n'existe pas)
-- Allowlist: postgres (DBA) + service_role (edge functions)

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
  -- DECISION: postgres ALLOWED for direct DBA maintenance
  -- DECISION: service_role ALLOWED for edge functions/webhooks
  v_is_server_context := (
    session_user = 'postgres'
    OR (
      EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
      AND pg_has_role(session_user, 'service_role', 'member')
    )
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
'Protège les factures paid contre les modifications non autorisées.

BYPASS: SET LOCAL app.internal_reconcile = ''1'';
ALLOWLIST (session_user uniquement):
  - postgres: maintenance DBA directe
  - service_role: edge functions, webhooks

NON AUTORISÉ: current_user, JWT claims, supabase_admin, supabase_functions_admin
';