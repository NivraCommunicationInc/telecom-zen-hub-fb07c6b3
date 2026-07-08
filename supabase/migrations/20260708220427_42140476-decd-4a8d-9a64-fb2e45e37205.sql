
CREATE OR REPLACE FUNCTION public.core_simulate_plan_change(
  p_account_id uuid,
  p_subscription_id uuid,
  p_new_plan_code text,
  p_new_plan_name text,
  p_new_plan_price numeric,
  p_change_type text DEFAULT 'upgrade',
  p_effective_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  -- Authz: admin/supervisor/support/staff_admin only
  IF NOT (
    public.has_role(v_caller, 'admin'::app_role)
    OR public.has_role(v_caller, 'staff_admin'::app_role)
    OR public.has_role(v_caller, 'supervisor'::app_role)
    OR public.has_role(v_caller, 'support'::app_role)
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: role admin/staff_admin/supervisor/support requis';
  END IF;

  SELECT * INTO v_account_row FROM accounts WHERE id = p_account_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compte introuvable: %', p_account_id;
  END IF;
  v_client_id := v_account_row.client_id;

  -- Load current subscription
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

  -- Prorata: only for immediate changes (upgrade / add_service)
  IF p_change_type IN ('upgrade', 'add_service') AND v_days_remaining IS NOT NULL AND v_cycle_total IS NOT NULL THEN
    IF p_change_type = 'add_service' THEN
      v_prorata := ROUND((COALESCE(p_new_plan_price, 0) * v_days_remaining::numeric / v_cycle_total::numeric)::numeric, 2);
    ELSE
      v_prorata := ROUND((GREATEST(v_delta, 0) * v_days_remaining::numeric / v_cycle_total::numeric)::numeric, 2);
    END IF;
  END IF;

  -- Impact next full invoice
  v_next_invoice_impact := COALESCE(p_new_plan_price, 0);

  -- Current equipment attached to this account
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

  -- Equipment recommendations by change type
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
        AND LOWER(COALESCE(ei.category, '')) IN ('internet', 'router', 'wifi', 'modem');
    END IF;
  END IF;

  IF p_change_type = 'add_service' THEN
    -- Determine if new plan is TV or Internet based on plan name/code
    IF p_new_plan_name ILIKE '%tv%' OR p_new_plan_code ILIKE '%tv%' THEN
      v_equipment_to_ship := jsonb_build_array(jsonb_build_object(
        'catalog_hint', 'Terminal TV',
        'quantity', 1,
        'reason', 'Requis pour activation service TV',
        'unit_price', 50
      ));
    ELSIF p_new_plan_name ILIKE '%internet%' OR p_new_plan_code ILIKE '%internet%' THEN
      v_equipment_to_ship := jsonb_build_array(jsonb_build_object(
        'catalog_hint', 'Borne WiFi',
        'quantity', 1,
        'reason', 'Requis pour activation Internet',
        'unit_price', 60
      ));
    END IF;
  END IF;

  -- Active promotions on this account
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ap.id,
    'label', ap.label,
    'amount', ap.amount,
    'promo_code', ap.promo_code,
    'months_remaining', ap.months_remaining,
    'expires_at', ap.expires_at,
    'promotion_type', ap.promotion_type,
    'impact_note', CASE
      WHEN p_change_type IN ('downgrade', 'remove_service') AND ap.promotion_type = 'plan_bound'
        THEN 'Sera annulée avec le retrait du forfait'
      ELSE 'Reste active'
    END
  )), '[]'::jsonb)
  INTO v_active_promotions
  FROM account_promotions ap
  WHERE ap.account_id = p_account_id AND ap.is_active = true;

  -- Plan change history
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', scr.id,
    'change_type', scr.change_type,
    'current_plan_name', scr.current_plan_name,
    'requested_plan_name', scr.requested_plan_name,
    'requested_plan_price', scr.requested_plan_price,
    'status', scr.status,
    'effective_date', scr.effective_date,
    'applied_at', scr.applied_at,
    'created_at', scr.created_at
  ) ORDER BY scr.created_at DESC), '[]'::jsonb)
  INTO v_plan_history
  FROM service_change_requests scr
  WHERE scr.account_id = p_account_id
  LIMIT 20;

  -- All active subscriptions (services actifs)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', bs.id,
    'plan_name', COALESCE(bs.frozen_name, bs.plan_name),
    'plan_code', COALESCE(bs.frozen_code, bs.plan_code),
    'plan_price', COALESCE(bs.frozen_unit_price, bs.plan_price),
    'service_category', bs.service_category,
    'status', bs.status,
    'cycle_start_date', bs.cycle_start_date,
    'cycle_end_date', bs.cycle_end_date,
    'service_address_id', bs.service_address_id
  ) ORDER BY bs.service_category), '[]'::jsonb)
  INTO v_active_services
  FROM billing_subscriptions bs
  WHERE bs.customer_id = v_customer_id AND bs.status IN ('active', 'trial');

  RETURN jsonb_build_object(
    'ok', true,
    'simulated_at', now(),
    'inputs', jsonb_build_object(
      'account_id', p_account_id,
      'subscription_id', p_subscription_id,
      'new_plan_code', p_new_plan_code,
      'new_plan_name', p_new_plan_name,
      'new_plan_price', p_new_plan_price,
      'change_type', p_change_type,
      'effective_date', p_effective_date
    ),
    'current_context', jsonb_build_object(
      'account_number', v_account_row.account_number,
      'previous_plan_name', v_prev_name,
      'previous_plan_price', v_prev_price,
      'previous_service_category', v_prev_category,
      'cycle_start_date', v_sub.cycle_start_date,
      'cycle_end_date', v_sub.cycle_end_date,
      'days_remaining', v_days_remaining,
      'cycle_total_days', v_cycle_total,
      'mrr_current', v_prev_price,
      'mrr_after_change', CASE
        WHEN p_change_type = 'remove_service' THEN 0
        WHEN p_change_type IN ('upgrade', 'downgrade') THEN p_new_plan_price
        WHEN p_change_type = 'add_service' THEN COALESCE(v_prev_price, 0) + COALESCE(p_new_plan_price, 0)
        ELSE p_new_plan_price
      END,
      'active_services', v_active_services,
      'current_equipment', v_current_equipment,
      'active_promotions', v_active_promotions,
      'plan_change_history', v_plan_history
    ),
    'impact', jsonb_build_object(
      'price_delta_monthly', v_delta,
      'prorata_amount', v_prorata,
      'prorata_immediate', p_change_type IN ('upgrade', 'add_service') AND v_prorata > 0,
      'next_invoice_impact', v_next_invoice_impact,
      'equipment_to_return', v_equipment_to_return,
      'equipment_to_ship', v_equipment_to_ship,
      'requires_provisioning', p_change_type IN ('upgrade', 'add_service'),
      'requires_appointment', p_change_type = 'add_service' AND jsonb_array_length(v_equipment_to_ship) > 0,
      'communications_planned', jsonb_build_array(
        CASE WHEN p_change_type IN ('upgrade', 'add_service')
          THEN jsonb_build_object('template', 'plan_change_approved', 'to', 'client')
          ELSE jsonb_build_object('template', 'plan_change_requested', 'to', 'client')
        END,
        jsonb_build_object('template', 'plan_change_admin_alert', 'to', 'support@nivra-telecom.ca')
      )
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.core_simulate_plan_change(uuid, uuid, text, text, numeric, text, date) TO authenticated;
