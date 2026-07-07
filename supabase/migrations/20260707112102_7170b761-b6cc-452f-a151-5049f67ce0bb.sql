CREATE OR REPLACE FUNCTION public.apply_plan_change(
  p_old_subscription_id uuid,
  p_new_plan_code text, p_new_plan_name text, p_new_plan_price numeric,
  p_new_frozen_code text DEFAULT NULL, p_new_frozen_name text DEFAULT NULL,
  p_context jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_old public.billing_subscriptions%ROWTYPE; v_new_id uuid;
BEGIN
  SELECT * INTO v_old FROM public.billing_subscriptions WHERE id=p_old_subscription_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Abonnement source % introuvable', p_old_subscription_id; END IF;
  IF v_old.status NOT IN ('active','pending','suspended') THEN
    RAISE EXCEPTION 'Abonnement % non-modifiable (statut=%)', p_old_subscription_id, v_old.status;
  END IF;
  IF v_old.superseded_by_subscription_id IS NOT NULL THEN
    RAISE EXCEPTION 'Abonnement % déjà remplacé par %', p_old_subscription_id, v_old.superseded_by_subscription_id;
  END IF;
  IF v_old.source_order_item_id IS NULL THEN
    RAISE EXCEPTION 'Abonnement % sans source_order_item_id — plan_change impossible', p_old_subscription_id
      USING ERRCODE='check_violation';
  END IF;

  INSERT INTO public.billing_subscriptions (
    customer_id, plan_code, plan_name, plan_price,
    frozen_code, frozen_name, frozen_unit_price, frozen_currency,
    frozen_cycle, frozen_frequency, frozen_anchor_date,
    cycle_start_date, cycle_end_date,
    status, service_category, address_id, service_address_id,
    order_id, source_type, source_id, environment,
    source_order_item_id,
    recurring_provider, supersedes_subscription_id, auto_billing_enabled
  ) VALUES (
    v_old.customer_id, p_new_plan_code, p_new_plan_name, p_new_plan_price,
    COALESCE(p_new_frozen_code, p_new_plan_code),
    COALESCE(p_new_frozen_name, p_new_plan_name),
    p_new_plan_price, COALESCE(v_old.frozen_currency,'CAD'),
    v_old.frozen_cycle, v_old.frozen_frequency, CURRENT_DATE,
    CURRENT_DATE, CURRENT_DATE + INTERVAL '1 month',
    'active', v_old.service_category, v_old.address_id, v_old.service_address_id,
    v_old.order_id, 'plan_change', p_old_subscription_id::text, v_old.environment,
    v_old.source_order_item_id,
    'square', p_old_subscription_id, COALESCE(v_old.auto_billing_enabled, true)
  ) RETURNING id INTO v_new_id;

  UPDATE public.billing_subscriptions
     SET status='cancelled', superseded_by_subscription_id=v_new_id, updated_at=now()
   WHERE id=p_old_subscription_id;

  PERFORM public._nivra_record_provenance(
    'billing_subscription', v_new_id, 'plan_change_applied','apply_plan_change', p_context,
    'billing_subscription', p_old_subscription_id,
    jsonb_build_object('old_plan_code', v_old.plan_code, 'old_frozen_price', v_old.frozen_unit_price,
                       'new_plan_code', p_new_plan_code, 'new_price', p_new_plan_price));
  PERFORM public._nivra_record_provenance(
    'billing_subscription', p_old_subscription_id, 'plan_change_superseded','apply_plan_change', p_context,
    'billing_subscription', v_new_id, jsonb_build_object('superseded_by', v_new_id));
  RETURN v_new_id;
END $$;