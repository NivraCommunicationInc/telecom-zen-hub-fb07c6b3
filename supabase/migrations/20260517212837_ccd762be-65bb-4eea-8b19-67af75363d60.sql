CREATE OR REPLACE FUNCTION public.check_billing_health()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.billing_subscriptions
  WHERE next_renewal_at IS NULL
    AND status = 'active';

  IF v_count > 0 THEN
    INSERT INTO public.billing_system_alerts (
      alert_type, entity_type, entity_id, details
    ) VALUES (
      'null_next_renewal_at_health_check',
      'billing_subscription',
      NULL,
      jsonb_build_object(
        'count', v_count,
        'severity', 'critical',
        'message', v_count || ' active subscriptions have NULL next_renewal_at',
        'checked_at', now()
      )
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.check_billing_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_billing_health() TO service_role;