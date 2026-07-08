CREATE OR REPLACE FUNCTION public.core_simulate_plan_change(
  p_account_id uuid,
  p_subscription_id uuid,
  p_new_plan_code text,
  p_new_plan_name text,
  p_new_plan_price numeric,
  p_change_type text DEFAULT 'upgrade'::text,
  p_effective_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_sub billing_subscriptions%ROWTYPE;
  v_customer_id uuid;
  v_client_id uuid;
  v_prev_price numeric;
  v_prev_name text;
  v_prev_category text;
  v_delta numeric;
  v_days_remaining int;
  v_cycle_total int;
  v_prorata numeric := 0;
  v_current_equipment jsonb;
  v_equipment_to_return jsonb := '[]'::jsonb;
  v_equipment_to_ship jsonb := '[]'::jsonb;
  v_active_promotions jsonb;
  v_plan_history jsonb;
  v_active_services jsonb;
  v_account_row accounts%ROWTYPE;
  v_next_invoice_impact numeric;
BEGIN
  -- Authz: admin / billing_admin / supervisor / support
  IF NOT (
    public.has_role(v_caller, 'admin'::app_role)
    OR public.has_role(v_caller, 'billing_admin'::app_role)
    OR public.has_role(v_caller, 'supervisor'::app_role)
    OR public.has_role(v_caller, 'support'::app_role)
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: role admin/billing_admin/supervisor/support requis';
  END IF;

  SELECT * INTO v_account_row FROM accounts WHERE id = p_account_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compte introuvable: %', p_account_id;
  END IF;
  v_client_id := v_account_row.client_id;

  SELECT * INTO v_sub FROM billing_subscriptions WHERE id = p_subscription_id;
  IF FOUND THEN
    v_customer_id := v_sub.customer_id;
    v_prev_price := COALESCE(v_sub.frozen_unit_price, v_sub.plan_price, 0);
    v_prev_name := COALESCE(v_sub.frozen_name, v_sub.plan_name);
    v_prev_category := v_sub.service_category;

    IF v_sub.cycle_end_date IS NOT NULL AND v_sub.cycle_start_date IS NOT NULL THEN
      v_days_remaining := GREATEST(1, (v_sub.cycle_end_date - p_effective_date));
      v_cycle_total := GREATEST(28, (v_sub.cycle_end_date - v_sub.cycle_start_date));
    END IF;
  ELSE
    v_prev_price := 0;
    v_prev_name := NULL;
    v_prev_category := NULL;
  END IF;

  v_delta := COALESCE(p_new_plan_price, 0) - COALESCE(v_prev_price, 0);

  IF p_change_type IN ('upgrade', 'add_service') AND v_days_remaining IS NOT NULL AND v_cycle_total IS NOT NULL THEN
    IF p_change_type = 'add_service' THEN
      v_prorata := ROUND((COALESCE(p_new_plan_price, 0) * v_days_remaining::numeric / v_cycle_total::numeric)::numeric, 2);
    ELSE
      v_prorata := ROUND((GREATEST(v_delta, 0) * v_days_remaining::numeric / v_cycle_total::numeric)::numeric, 2);
    END IF;
  END IF;

  v_next_invoice_impact := COALESCE(p_new_plan_price, 0);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ei.id,
    'catalog_name', ei.catalog_name,
    'serial_number', ei.serial_number,
    'mac_address', ei.mac_address,
    'category', ei.category,
    'status', ei.status,
    'order_id', ei.order_id
  ) ORDER BY ei.category, ei.catalog_name), '[]'::jsonb)
  INTO v_current_equipment
  FROM equipment_inventory ei
  JOIN orders o ON o.id = ei.order_id
  WHERE o.user_id = v_client_id;

  IF p_change_type IN ('downgrade', 'remove_service') AND v_prev_category IS NOT NULL THEN
    IF LOWER(v_prev_category) = 'tv' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', ei.id, 'catalog_name', ei.catalog_name, 'serial_number', ei.serial_number,
        'category', ei.category, 'reason', 'Terminal TV à retourner (retrait service TV)'
      )), '[]'::jsonb) INTO v_equipment_to_return
      FROM equipment_inventory ei
      JOIN orders o ON o.id = ei.order_id
      WHERE o.user_id = v_client_id
        AND LOWER(COALESCE(ei.category, '')) IN ('tv', 'terminal', 'terminal_tv', 'set_top_box');
    ELSIF LOWER(v_prev_category) = 'internet' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', ei.id, 'catalog_name', ei.catalog_name, 'serial_number', ei.serial_number,
        'category', ei.category, 'reason', 'Borne WiFi à retourner (retrait Internet)'
      )), '[]'::jsonb) INTO v_equipment_to_return
      FROM equipment_inventory ei
      JOIN orders o ON o.id = ei.order_id
      WHERE o.user_id = v_client_id
        AND LOWER(COALESCE(ei.category, '')) IN ('internet', 'modem', 'router', 'borne_wifi');
    END IF;
  END IF;

  IF p_change_type = 'add_service' THEN
    IF LOWER(COALESCE(p_new_plan_code,'')) LIKE '%tv%' OR LOWER(COALESCE(p_new_plan_name,'')) LIKE '%tv%' THEN
      v_equipment_to_ship := jsonb_build_array(jsonb_build_object(
        'catalog_hint','Terminal TV','quantity',1,'reason','Nouveau service TV','unit_price',50));
    ELSIF LOWER(COALESCE(p_new_plan_code,'')) LIKE '%internet%' OR LOWER(COALESCE(p_new_plan_name,'')) LIKE '%internet%' THEN
      v_equipment_to_ship := jsonb_build_array(jsonb_build_object(
        'catalog_hint','Borne WiFi','quantity',1,'reason','Nouveau service Internet','unit_price',60));
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ap.id, 'label', ap.label, 'amount', ap.amount,
    'promo_code', ap.promo_code, 'expires_at', ap.expires_at
  )), '[]'::jsonb)
  INTO v_active_promotions
  FROM account_promotions ap
  WHERE ap.account_id = p_account_id AND ap.is_active = true;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', bs.id, 'plan_name', bs.plan_name, 'plan_price', bs.plan_price,
    'service_category', bs.service_category, 'status', bs.status,
    'cycle_start_date', bs.cycle_start_date, 'cycle_end_date', bs.cycle_end_date
  ) ORDER BY bs.created_at), '[]'::jsonb)
  INTO v_active_services
  FROM billing_subscriptions bs
  WHERE bs.customer_id = v_client_id AND bs.status IN ('active','trial');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', scr.id, 'change_type', scr.change_type,
    'current_plan_name', scr.current_plan_name,
    'requested_plan_name', scr.requested_plan_name,
    'requested_plan_price', scr.requested_plan_price,
    'status', scr.status, 'created_at', scr.created_at
  ) ORDER BY scr.created_at DESC), '[]'::jsonb)
  INTO v_plan_history
  FROM service_change_requests scr
  WHERE scr.account_id = p_account_id
  LIMIT 5;

  RETURN jsonb_build_object(
    'ok', true,
    'current_context', jsonb_build_object(
      'client_id', v_client_id,
      'account_id', p_account_id,
      'subscription_id', p_subscription_id,
      'previous_plan_name', v_prev_name,
      'previous_plan_price', v_prev_price,
      'previous_category', v_prev_category,
      'mrr_current', (SELECT COALESCE(SUM(plan_price),0) FROM billing_subscriptions WHERE customer_id = v_client_id AND status IN ('active','trial')),
      'mrr_after_change', (SELECT COALESCE(SUM(plan_price),0) FROM billing_subscriptions WHERE customer_id = v_client_id AND status IN ('active','trial')) - COALESCE(v_prev_price,0) + COALESCE(p_new_plan_price,0),
      'cycle_days_remaining', v_days_remaining,
      'cycle_total_days', v_cycle_total,
      'cycle_end_date', v_sub.cycle_end_date,
      'active_services', v_active_services,
      'current_equipment', v_current_equipment,
      'active_promotions', v_active_promotions,
      'plan_history', v_plan_history
    ),
    'impact', jsonb_build_object(
      'change_type', p_change_type,
      'price_delta_monthly', v_delta,
      'prorata_immediate', (p_change_type IN ('upgrade','add_service')),
      'prorata_amount', v_prorata,
      'next_invoice_impact', v_next_invoice_impact,
      'equipment_to_return', v_equipment_to_return,
      'equipment_to_ship', v_equipment_to_ship,
      'requires_provisioning', (p_change_type IN ('upgrade','add_service')),
      'requires_appointment', (p_change_type = 'add_service'),
      'communications_planned', jsonb_build_array(
        jsonb_build_object('template','plan_change_approved','to','customer'),
        jsonb_build_object('template','core.plan_change.internal','to','ops')
      )
    )
  );
END;
$function$;