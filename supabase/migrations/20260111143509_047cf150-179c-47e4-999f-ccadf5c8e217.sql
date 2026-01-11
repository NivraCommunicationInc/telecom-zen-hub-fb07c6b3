-- Helper function to get DB context information
CREATE OR REPLACE FUNCTION public.get_db_context()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'session_user', session_user,
    'current_user', current_user,
    'role_exists', EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role'),
    'has_service_role', CASE 
      WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') 
      THEN pg_has_role(session_user, 'service_role', 'member')
      ELSE NULL 
    END
  );
$$;

-- Test function that sets bypass flag and attempts update
CREATE OR REPLACE FUNCTION public.test_bypass_update(invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_rows_affected int;
BEGIN
  -- Set the bypass flag for this transaction
  PERFORM set_config('app.internal_reconcile', '1', true);
  
  -- Attempt the update
  UPDATE billing 
  SET notes = COALESCE(notes, '') || ' [TEST]'
  WHERE id = invoice_id;
  
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  
  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'rows_affected', v_rows_affected,
    'session_user', session_user,
    'current_user', current_user,
    'bypass_flag', current_setting('app.internal_reconcile', true)
  );
  
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'session_user', session_user,
    'current_user', current_user
  );
END;
$$;

-- Grant execute to service_role only
GRANT EXECUTE ON FUNCTION public.get_db_context() TO service_role;
GRANT EXECUTE ON FUNCTION public.test_bypass_update(uuid) TO service_role;