
CREATE OR REPLACE FUNCTION public.rpc_qa_purge_subscription_fixture(p_subscription_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_deleted int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: admin role required for QA purge';
  END IF;
  IF p_subscription_ids IS NULL OR array_length(p_subscription_ids,1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'deleted', 0);
  END IF;
  DELETE FROM public.billing_subscriptions WHERE id = ANY(p_subscription_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted', v_deleted);
END;
$$;

INSERT INTO public.billing_subscription_writer_allowlist (function_name, category, allowed_operations, active, notes)
VALUES ('rpc_qa_purge_subscription_fixture','qa_cleanup', ARRAY['INSERT','UPDATE','DELETE'], true, 'QA teardown by explicit sub IDs (admin only)')
ON CONFLICT (function_name) DO UPDATE
SET allowed_operations = ARRAY['INSERT','UPDATE','DELETE'], active = true;

GRANT EXECUTE ON FUNCTION public.rpc_qa_purge_subscription_fixture(uuid[]) TO authenticated, service_role;
