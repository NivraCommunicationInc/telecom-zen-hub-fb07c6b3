
-- Fix infinite recursion: provision_services_for_order should NOT update orders.status
-- That's the trigger's job. The function just provisions services.
CREATE OR REPLACE FUNCTION public.provision_services_for_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_customer_id UUID;
  v_subscription_id UUID;
  v_line_items JSONB;
  v_item JSONB;
  v_services_created INT := 0;
  v_plan_name TEXT;
  v_plan_code TEXT;
  v_plan_price NUMERIC := 0;
  v_cycle_start DATE;
  v_cycle_end DATE;
BEGIN
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  v_line_items := v_order.equipment_details->'line_items';
  IF v_line_items IS NULL OR jsonb_array_length(v_line_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No line_items in equipment_details');
  END IF;

  SELECT id INTO v_customer_id
  FROM billing_customers
  WHERE user_id = v_order.user_id
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No billing_customer for user');
  END IF;

  v_plan_name := COALESCE(v_order.service_type, 'Service');
  v_plan_code := 'order-' || v_order.order_number;
  v_cycle_start := CURRENT_DATE;
  v_cycle_end := CURRENT_DATE + INTERVAL '30 days';

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_line_items)
  LOOP
    IF (v_item->>'type') IN ('tv', 'internet', 'mobile', 'streaming', 'addon')
       AND (v_item->>'period') = 'monthly' THEN
      v_plan_price := v_plan_price + COALESCE((v_item->>'unit_price')::NUMERIC, 0)
                      * COALESCE((v_item->>'qty')::INT, 1);
    END IF;
  END LOOP;

  SELECT id INTO v_subscription_id
  FROM billing_subscriptions
  WHERE customer_id = v_customer_id
    AND plan_code = v_plan_code;

  IF v_subscription_id IS NULL THEN
    SELECT id INTO v_subscription_id
    FROM billing_subscriptions
    WHERE customer_id = v_customer_id
      AND status = 'pending'
      AND plan_name = v_plan_name
    LIMIT 1;

    IF v_subscription_id IS NOT NULL THEN
      UPDATE billing_subscriptions SET
        plan_code = v_plan_code,
        plan_price = v_plan_price,
        cycle_start_date = v_cycle_start,
        cycle_end_date = v_cycle_end,
        status = 'active',
        service_category = v_order.category,
        updated_at = NOW()
      WHERE id = v_subscription_id;
    ELSE
      INSERT INTO billing_subscriptions (
        customer_id, plan_code, plan_name, plan_price,
        cycle_start_date, cycle_end_date, status, service_category
      ) VALUES (
        v_customer_id, v_plan_code, v_plan_name, v_plan_price,
        v_cycle_start, v_cycle_end, 'active', v_order.category
      )
      RETURNING id INTO v_subscription_id;
    END IF;
  ELSE
    UPDATE billing_subscriptions SET
      status = 'active',
      plan_price = v_plan_price,
      updated_at = NOW()
    WHERE id = v_subscription_id;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_line_items)
  LOOP
    IF (v_item->>'type') IN ('tv', 'internet', 'mobile', 'streaming', 'addon', 'router', 'terminal') THEN
      INSERT INTO billing_subscription_services (
        subscription_id, service_name, service_code,
        service_type, unit_price, quantity, is_active
      ) VALUES (
        v_subscription_id,
        v_item->>'name',
        COALESCE(v_item->>'ref_id', (v_item->>'type') || '-' || md5(v_item->>'name')),
        CASE WHEN (v_item->>'period') = 'monthly' THEN 'recurring' ELSE 'one_time' END,
        COALESCE((v_item->>'unit_price')::NUMERIC, 0),
        COALESCE((v_item->>'qty')::INT, 1),
        true
      )
      ON CONFLICT DO NOTHING;
      IF FOUND THEN
        v_services_created := v_services_created + 1;
      END IF;
    END IF;
  END LOOP;

  -- DO NOT update orders.status here — the trigger handles that
  
  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_subscription_id,
    'services_created', v_services_created,
    'plan_name', v_plan_name,
    'plan_price', v_plan_price
  );
END;
$$;
