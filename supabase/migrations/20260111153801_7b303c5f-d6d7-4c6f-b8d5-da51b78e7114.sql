-- TEMPORARY TEST FUNCTIONS - DELETE AFTER VALIDATION

-- Function to get current context
CREATE OR REPLACE FUNCTION public.get_current_context()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'session_user', session_user::text,
    'current_user', current_user::text,
    'is_service_role_member', pg_has_role(current_user, 'service_role', 'member')
  );
$$;

-- Function to test the paid invoice bypass
CREATE OR REPLACE FUNCTION public.test_paid_invoice_bypass_proof(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_old_notes text;
  v_update_success boolean := false;
  v_error_message text;
BEGIN
  -- Get context info
  v_result := jsonb_build_object(
    'session_user', session_user::text,
    'current_user', current_user::text,
    'is_service_role_member', pg_has_role(current_user, 'service_role', 'member'),
    'current_user_is_service_role', (current_user = 'service_role')
  );

  -- Get current notes value
  SELECT notes INTO v_old_notes FROM billing WHERE id = p_invoice_id;

  -- Attempt the bypass update
  BEGIN
    -- Set the bypass flag
    PERFORM set_config('app.internal_reconcile', '1', true);
    
    -- Try the update (notes = notes is a no-op but triggers the trigger)
    UPDATE billing SET notes = COALESCE(notes, '') || '' WHERE id = p_invoice_id;
    
    v_update_success := true;
  EXCEPTION WHEN OTHERS THEN
    v_error_message := SQLERRM;
    v_update_success := false;
  END;

  -- Add results
  v_result := v_result || jsonb_build_object(
    'update_success', v_update_success,
    'error_message', v_error_message,
    'tested_invoice_id', p_invoice_id::text
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_current_context() IS 'TEMPORARY - DELETE AFTER PROOF 4 VALIDATION';
COMMENT ON FUNCTION public.test_paid_invoice_bypass_proof(uuid) IS 'TEMPORARY - DELETE AFTER PROOF 4 VALIDATION';