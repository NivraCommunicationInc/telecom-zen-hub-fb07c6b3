-- Update provision_services_for_order to handle duplicate service constraint gracefully
CREATE OR REPLACE FUNCTION public.provision_services_for_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_customer_id uuid;
  v_subscription_id uuid;
  v_line jsonb;
  v_lines jsonb;
  v_services_created int := 0;
  v_plan_name text;
  v_plan_code text;
  v_plan_price numeric;
  v_service_category text;
  v_address_id uuid;
  v_existing_sub_id uuid;
BEGIN
  -- Lock order row
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND', 'message', 'Commande introuvable');
  END IF;

  -- Find billing_customer by user_id
  SELECT id INTO v_customer_id FROM billing_customers WHERE user_id = v_order.user_id LIMIT 1;
  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'CUSTOMER_NOT_FOUND', 'message', 'Client facturation introuvable');
  END IF;

  -- Check if already provisioned (idempotence)
  SELECT id INTO v_existing_sub_id FROM billing_subscriptions WHERE order_id = p_order_id LIMIT 1;
  IF v_existing_sub_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_provisioned', true, 'subscription_id', v_existing_sub_id, 'services_created', 0);
  END IF;

  -- Extract line_items from equipment_details
  v_lines := COALESCE(v_order.equipment_details::jsonb -> 'line_items', '[]'::jsonb);
  IF jsonb_array_length(v_lines) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_LINE_ITEMS', 'message', 'Aucun item à provisionner');
  END IF;

  -- Determine plan info from first recurring item or order
  v_plan_name := COALESCE(v_order.service_type, 'Service');
  v_plan_code := 'order-' || v_order.order_number;
  v_plan_price := 0;
  v_service_category := 'other';

  -- Detect category from service_type
  IF lower(v_order.service_type) LIKE '%internet%' THEN v_service_category := 'internet';
  ELSIF lower(v_order.service_type) LIKE '%tv%' OR lower(v_order.service_type) LIKE '%giga%' THEN v_service_category := 'tv';
  ELSIF lower(v_order.service_type) LIKE '%combo%' THEN v_service_category := 'combo_tv_internet';
  ELSIF lower(v_order.service_type) LIKE '%mobile%' THEN v_service_category := 'mobile';
  END IF;

  -- Find first recurring for price
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    IF (v_line ->> 'type') = 'recurring' THEN
      v_plan_name := COALESCE(v_line ->> 'name', v_plan_name);
      v_plan_price := COALESCE((v_line ->> 'price')::numeric, 0);
      EXIT;
    END IF;
  END LOOP;

  -- Resolve address_id from order service_address
  IF v_order.service_address IS NOT NULL AND v_service_category IN ('internet', 'tv', 'combo_tv_internet') THEN
    SELECT id INTO v_address_id FROM service_addresses
    WHERE address_line = v_order.service_address
      AND account_id IN (SELECT a.id FROM accounts a WHERE a.client_id = v_order.user_id)
      AND is_active = true
    LIMIT 1;
  END IF;

  -- Create subscription (catch duplicate constraint)
  BEGIN
    INSERT INTO billing_subscriptions (
      customer_id, plan_code, plan_name, plan_price,
      cycle_start_date, cycle_end_date, status,
      order_id, address_id, service_category
    ) VALUES (
      v_customer_id, v_plan_code, v_plan_name, v_plan_price,
      CURRENT_DATE, CURRENT_DATE + interval '30 days', 'pending',
      p_order_id, v_address_id, v_service_category
    ) RETURNING id INTO v_subscription_id;
  EXCEPTION WHEN unique_violation THEN
    -- Friendly error for duplicate service at same address
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_SERVICE_AT_ADDRESS',
      'message', 'Un service ' || v_service_category || ' est déjà actif ou en cours à cette adresse. Veuillez choisir une autre adresse ou annuler le service existant.',
      'service_category', v_service_category,
      'address_id', v_address_id
    );
  END;

  -- Create service lines
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    BEGIN
      INSERT INTO billing_subscription_services (
        subscription_id, service_code, service_name, service_type,
        unit_price, quantity, is_active
      ) VALUES (
        v_subscription_id,
        COALESCE(v_line ->> 'service_id', v_line ->> 'code', gen_random_uuid()::text),
        COALESCE(v_line ->> 'name', 'Service'),
        COALESCE(v_line ->> 'type', 'recurring'),
        COALESCE((v_line ->> 'price')::numeric, 0),
        COALESCE((v_line ->> 'quantity')::int, 1),
        true
      );
      v_services_created := v_services_created + 1;
    EXCEPTION WHEN unique_violation THEN
      -- Skip duplicates silently (idempotence)
      NULL;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_subscription_id,
    'services_created', v_services_created,
    'service_category', v_service_category,
    'address_id', v_address_id
  );
END;
$$;