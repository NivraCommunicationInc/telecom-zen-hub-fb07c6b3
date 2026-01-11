-- Harden protect_paid_invoice bypass detection (P0)
-- Uses ONLY session_user-based checks with role existence guards
-- Removes exploitable current_user and JWT checks
--
-- ALLOWED SERVER ROLES (verified from pg_roles):
--   - supabase_admin (superuser, migrations)
--   - service_role (edge functions, webhooks)
--   - supabase_functions_admin (edge function execution context)
--   - postgres (maintenance, explicit decision: ALLOWED for DB admin tasks)

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
  -- Allow INSERT (new records) without restriction
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Only protect invoices that are already paid
  IF OLD.status NOT IN ('paid', 'finalized') THEN
    RETURN NEW;
  END IF;

  -- Check for internal reconciliation bypass flag
  v_bypass := current_setting('app.internal_reconcile', true);

  -- SECURITY: Bypass detection using session_user ONLY (not current_user which is always 'postgres' in SECURITY DEFINER)
  -- All role checks are guarded by EXISTS to prevent errors if role doesn't exist
  --
  -- DECISION LOG:
  --   - session_user = 'postgres': ALLOWED - used for direct DB maintenance by admins
  --   - session_user = 'supabase_admin': ALLOWED - superuser for migrations
  --   - service_role membership: ALLOWED - edge functions and webhooks
  --   - supabase_functions_admin membership: ALLOWED - edge function execution
  --
  -- EXPLICITLY NOT ALLOWED (spoofable or exploitable):
  --   - current_user checks (always owner in SECURITY DEFINER)
  --   - request.jwt.claims (can be spoofed via set_config)
  --   - Any client-settable GUC without server context validation
  
  v_is_server_context := (
    -- Direct server session users (maintenance/admin)
    session_user IN ('postgres', 'supabase_admin')
    -- service_role membership (edge functions, webhooks)
    OR (
      EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
      AND pg_has_role(session_user, 'service_role', 'member')
    )
    -- supabase_functions_admin membership (edge function context)
    OR (
      EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_functions_admin')
      AND pg_has_role(session_user, 'supabase_functions_admin', 'member')
    )
  );

  -- If bypass requested AND caller is verified server context, allow modification
  IF v_bypass = '1' AND v_is_server_context THEN
    RETURN NEW;
  END IF;

  -- If bypass requested but NOT in server context, this is a security violation attempt
  IF v_bypass = '1' AND NOT v_is_server_context THEN
    RAISE WARNING '[SECURITY] Unauthorized bypass attempt on paid invoice % by session_user=%, current_user=%',
      OLD.id, session_user, current_user;
    RAISE EXCEPTION 'IMMUTABILITY: Paid invoice % cannot be modified (unauthorized bypass attempt)', OLD.id;
  END IF;

  -- Standard immutability protection: block modifications to paid invoices
  -- Only status changes to 'disputed' are allowed for payment dispute workflow
  IF NEW.status = 'disputed' AND OLD.status IN ('paid', 'finalized') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'IMMUTABILITY: Paid/finalized invoice % cannot be modified', OLD.id;
END;
$$;

-- Add function comment documenting the security model
COMMENT ON FUNCTION public.protect_paid_invoice() IS 
'Trigger function protecting paid/finalized invoices from unauthorized modification.

BYPASS MECHANISM:
  SET LOCAL app.internal_reconcile = ''1'';
  
BYPASS AUTHORIZATION (session_user-based ONLY):
  - postgres: Direct DB admin maintenance
  - supabase_admin: Superuser migrations
  - service_role members: Edge functions, webhooks
  - supabase_functions_admin members: Edge function execution context

SECURITY NOTES:
  - Uses session_user (connection identity) not current_user (function owner)
  - All pg_has_role checks guarded by role existence check
  - Unauthorized bypass attempts are logged and rejected
  - JWT claims NOT used (spoofable via set_config)

ALLOWED MODIFICATIONS WITHOUT BYPASS:
  - INSERT: Always allowed
  - Status change to disputed: Allowed for payment disputes
';