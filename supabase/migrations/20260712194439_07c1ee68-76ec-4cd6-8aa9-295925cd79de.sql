
CREATE OR REPLACE FUNCTION public.qa_purge_subscription(_subscription_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.billing_subscription_services WHERE subscription_id = _subscription_id;
  DELETE FROM public.billing_subscriptions WHERE id = _subscription_id;
END;
$$;

INSERT INTO public.billing_subscription_writer_allowlist (function_name, allowed_operations, category, active, notes)
VALUES ('qa_purge_subscription', ARRAY['DELETE','UPDATE'], 'qa', true, 'QA-only teardown for test fixture subscriptions')
ON CONFLICT (function_name) DO UPDATE
  SET allowed_operations = EXCLUDED.allowed_operations,
      active = true,
      notes = EXCLUDED.notes,
      updated_at = now();

REVOKE ALL ON FUNCTION public.qa_purge_subscription(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qa_purge_subscription(uuid) TO service_role;
