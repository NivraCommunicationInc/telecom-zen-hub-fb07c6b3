CREATE OR REPLACE FUNCTION public.create_subscription_ad_hoc(
  p_customer_id       uuid,
  p_plan_code         text,
  p_plan_name         text,
  p_plan_price        numeric,
  p_service_category  text,
  p_cycle_start       date,
  p_cycle_end         date,
  p_context           jsonb DEFAULT '{}'::jsonb,
  p_address_id        uuid  DEFAULT NULL,
  p_order_id          uuid  DEFAULT NULL,
  p_status            text  DEFAULT 'pending',
  p_auto_billing      boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sub_id uuid;
BEGIN
  IF p_customer_id IS NULL OR p_plan_code IS NULL OR p_plan_name IS NULL THEN
    RAISE EXCEPTION 'customer_id, plan_code et plan_name requis' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_plan_price IS NULL OR p_plan_price < 0 THEN
    RAISE EXCEPTION 'plan_price invalide' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Idempotence
  IF p_order_id IS NOT NULL THEN
    SELECT id INTO v_sub_id
      FROM public.billing_subscriptions
     WHERE order_id = p_order_id
       AND customer_id = p_customer_id
       AND (p_service_category IS NULL OR service_category = p_service_category)
     ORDER BY created_at DESC
     LIMIT 1;
    IF v_sub_id IS NOT NULL THEN
      RETURN v_sub_id;
    END IF;
  END IF;

  INSERT INTO public.billing_subscriptions (
    customer_id, plan_code, plan_name, plan_price, service_category,
    cycle_start_date, cycle_end_date, billing_anchor_date,
    status, auto_billing_enabled, order_id, address_id, environment,
    frozen_name, frozen_code, frozen_unit_price,
    frozen_currency, frozen_cycle, frozen_frequency, frozen_anchor_date,
    source_type, source_id
  ) VALUES (
    p_customer_id, p_plan_code, p_plan_name, ROUND(p_plan_price,2), p_service_category,
    p_cycle_start, p_cycle_end, p_cycle_start,
    COALESCE(p_status,'pending')::billing_subscription_status,
    COALESCE(p_auto_billing,false),
    p_order_id, p_address_id, 'live',
    p_plan_name, p_plan_code, ROUND(p_plan_price,2),
    'CAD', 'monthly', 'monthly', p_cycle_start,
    COALESCE(NULLIF(p_context->>'source_type',''), 'ad_hoc'),
    NULLIF(p_context->>'source_id','')
  ) RETURNING id INTO v_sub_id;

  PERFORM public._nivra_record_provenance(
    'billing_subscription', v_sub_id, 'created', 'create_subscription_ad_hoc', p_context,
    CASE WHEN p_order_id IS NOT NULL THEN 'order' ELSE NULL END,
    p_order_id,
    jsonb_build_object('plan_code', p_plan_code, 'plan_name', p_plan_name, 'plan_price', p_plan_price)
  );

  RETURN v_sub_id;
END;
$$;