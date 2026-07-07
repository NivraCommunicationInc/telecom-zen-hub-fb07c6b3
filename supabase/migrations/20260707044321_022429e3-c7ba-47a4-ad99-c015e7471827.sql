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
  v_sub_id            uuid;
  v_user_id           uuid;
  v_account_id        uuid;
  v_order_id          uuid := p_order_id;
  v_item_id           uuid;
  v_service_type      text;
BEGIN
  IF p_customer_id IS NULL OR p_plan_code IS NULL OR p_plan_name IS NULL THEN
    RAISE EXCEPTION 'customer_id, plan_code et plan_name requis' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_plan_price IS NULL OR p_plan_price < 0 THEN
    RAISE EXCEPTION 'plan_price invalide' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Idempotence (si order fourni et sub existe déjà)
  IF v_order_id IS NOT NULL THEN
    SELECT id INTO v_sub_id
      FROM public.billing_subscriptions
     WHERE order_id = v_order_id
       AND customer_id = p_customer_id
       AND (p_service_category IS NULL OR service_category = p_service_category)
     ORDER BY created_at DESC
     LIMIT 1;
    IF v_sub_id IS NOT NULL THEN RETURN v_sub_id; END IF;
  END IF;

  -- Résolution user + account pour synthétiser une commande interne
  SELECT bc.user_id INTO v_user_id FROM public.billing_customers bc WHERE bc.id = p_customer_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'billing_customer % sans user_id : abonnement ad-hoc requiert un user_id lié', p_customer_id
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT id INTO v_account_id FROM public.accounts WHERE client_id = v_user_id ORDER BY created_at DESC LIMIT 1;
  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'accounts introuvable pour user % : créez le compte avant l''abonnement', v_user_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- service_type doit correspondre à l'enum order_item_service_type
  v_service_type := CASE lower(COALESCE(p_service_category,''))
    WHEN 'internet' THEN 'internet'
    WHEN 'tv'       THEN 'tv'
    WHEN 'mobile'   THEN 'mobile'
    WHEN 'streaming' THEN 'streaming'
    WHEN 'security'  THEN 'security'
    WHEN 'addon'     THEN 'addon'
    WHEN 'equipment' THEN 'equipment'
    ELSE 'addon'
  END;

  -- Synthétise une commande interne si pas fournie
  IF v_order_id IS NULL THEN
    INSERT INTO public.orders (
      user_id, account_id, order_number, status, payment_status, payment_method,
      service_type, subtotal, total_amount, environment, source, internal_notes
    ) VALUES (
      v_user_id, v_account_id,
      'ADHOC-' || to_char(now(),'YYYYMMDD') || '-' || substring(gen_random_uuid()::text,1,8),
      'submitted', 'pending', 'manual',
      v_service_type, ROUND(p_plan_price,2), ROUND(p_plan_price * 1.14975, 2),
      'live', 'ad_hoc_subscription',
      COALESCE(NULLIF(p_context->>'reason',''), 'ad_hoc_subscription_creation')
    ) RETURNING id INTO v_order_id;
  END IF;

  -- Ligne de commande source (source de vérité pour l'abonnement)
  INSERT INTO public.order_items (
    order_id, item_number, plan_code, plan_name, service_type,
    unit_price, quantity, line_total, is_recurring
  ) VALUES (
    v_order_id, 1, p_plan_code, p_plan_name,
    v_service_type::order_item_service_type,
    ROUND(p_plan_price,2), 1, ROUND(p_plan_price,2), true
  ) RETURNING id INTO v_item_id;

  -- Abonnement figé (source_order_item_id satisfait l'invariant)
  INSERT INTO public.billing_subscriptions (
    customer_id, plan_code, plan_name, plan_price, service_category,
    cycle_start_date, cycle_end_date, billing_anchor_date,
    status, auto_billing_enabled, order_id, address_id, environment,
    source_order_item_id,
    frozen_name, frozen_code, frozen_unit_price,
    frozen_currency, frozen_cycle, frozen_frequency, frozen_anchor_date,
    source_type, source_id
  ) VALUES (
    p_customer_id, p_plan_code, p_plan_name, ROUND(p_plan_price,2), p_service_category,
    p_cycle_start, p_cycle_end, p_cycle_start,
    COALESCE(p_status,'pending')::billing_subscription_status,
    COALESCE(p_auto_billing,false),
    v_order_id, p_address_id, 'live',
    v_item_id,
    p_plan_name, p_plan_code, ROUND(p_plan_price,2),
    'CAD', 'monthly', 'monthly', p_cycle_start,
    COALESCE(NULLIF(p_context->>'source_type',''), 'ad_hoc'),
    v_item_id::text
  ) RETURNING id INTO v_sub_id;

  PERFORM public._nivra_record_provenance(
    'billing_subscription', v_sub_id, 'created', 'create_subscription_ad_hoc', p_context,
    'order_item', v_item_id,
    jsonb_build_object('plan_code', p_plan_code, 'plan_name', p_plan_name,
                       'plan_price', p_plan_price, 'synthetic_order_id', v_order_id)
  );

  RETURN v_sub_id;
END;
$$;