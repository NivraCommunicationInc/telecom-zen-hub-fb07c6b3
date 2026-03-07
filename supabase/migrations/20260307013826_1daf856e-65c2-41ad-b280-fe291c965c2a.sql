-- Ensure provisioning works for all completion paths and all order payload shapes
CREATE OR REPLACE FUNCTION public.provision_services_for_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order record;
  v_customer_id uuid;
  v_line_items jsonb;
  v_item jsonb;
  v_sub_id uuid;
  v_services_created int := 0;
  v_inserted_services int := 0;
  v_category text;
  v_address_id uuid;
  v_address_hash text;
  v_address_snapshot jsonb;
  v_rows int := 0;
  v_item_type text;
  v_item_category text;
  v_service_row_type text;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND');
  END IF;

  SELECT bi.customer_id INTO v_customer_id
  FROM public.billing_invoices bi
  WHERE bi.order_id = p_order_id
  ORDER BY bi.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    SELECT bc.id INTO v_customer_id
    FROM public.billing_customers bc
    WHERE bc.user_id = v_order.user_id
    LIMIT 1;
  END IF;

  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'CUSTOMER_NOT_FOUND');
  END IF;

  -- Canonical/fallback line items (supports both old and new order payloads)
  v_line_items := COALESCE(v_order.line_items, v_order.equipment_details->'line_items');

  IF v_line_items IS NULL OR jsonb_typeof(v_line_items) <> 'array' OR jsonb_array_length(v_line_items) = 0 THEN
    v_line_items := jsonb_build_array(
      jsonb_build_object(
        'type', 'service',
        'category', 'service',
        'code', COALESCE(v_order.service_type, 'service'),
        'name', COALESCE(v_order.service_type, 'Service'),
        'price', COALESCE(v_order.subtotal, v_order.total_amount, 0),
        'quantity', 1
      )
    );
  END IF;

  v_category := CASE
    WHEN v_order.service_type ILIKE '%internet%' THEN 'internet'
    WHEN v_order.service_type ILIKE '%tv%' OR v_order.service_type ILIKE '%télé%' THEN 'tv'
    WHEN v_order.service_type ILIKE '%combo%' OR v_order.service_type ILIKE '%bundle%' THEN 'combo'
    WHEN v_order.service_type ILIKE '%mobile%' OR v_order.service_type ILIKE '%cell%' THEN 'mobile'
    WHEN v_order.service_type ILIKE '%streaming%' THEN 'streaming'
    ELSE 'other'
  END;

  IF v_category IN ('internet', 'tv', 'combo') THEN
    v_address_id := public.resolve_or_create_service_address(v_customer_id, p_order_id);

    IF v_address_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'ADDRESS_REQUIRED',
        'message', 'Une adresse de service est requise pour Internet/TV/Combo'
      );
    END IF;

    SELECT sa.address_hash INTO v_address_hash
    FROM public.service_addresses sa
    WHERE sa.id = v_address_id
    LIMIT 1;

    -- Duplicate guard by normalized address hash + service category (active lifecycle)
    IF v_address_hash IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.billing_subscriptions bs
      JOIN public.service_addresses sa ON sa.id = bs.address_id
      WHERE bs.customer_id = v_customer_id
        AND lower(COALESCE(bs.service_category, '')) = v_category
        AND bs.status::text IN ('active', 'pending', 'suspended')
        AND sa.address_hash = v_address_hash
        AND (bs.order_id IS DISTINCT FROM p_order_id)
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'DUPLICATE_SERVICE_AT_ADDRESS',
        'message', 'Un service de cette catégorie est déjà actif à cette adresse.'
      );
    END IF;
  END IF;

  -- Immutable address snapshot on invoice
  IF v_address_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'address_id', sa.id,
      'label', sa.label,
      'address_line', sa.address_line,
      'city', sa.city,
      'province', sa.province,
      'postal_code', sa.postal_code,
      'snapshot_at', now()
    ) INTO v_address_snapshot
    FROM public.service_addresses sa
    WHERE sa.id = v_address_id;

    UPDATE public.billing_invoices
    SET address_snapshot = v_address_snapshot
    WHERE order_id = p_order_id
      AND address_snapshot IS NULL;
  END IF;

  -- Reuse or create subscription for this order
  SELECT bs.id INTO v_sub_id
  FROM public.billing_subscriptions bs
  WHERE bs.order_id = p_order_id
    AND bs.customer_id = v_customer_id
  ORDER BY bs.created_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF v_sub_id IS NULL THEN
    INSERT INTO public.billing_subscriptions (
      customer_id,
      plan_code,
      plan_name,
      plan_price,
      cycle_start_date,
      cycle_end_date,
      status,
      order_id,
      address_id,
      service_category
    ) VALUES (
      v_customer_id,
      COALESCE(v_order.service_type, 'unknown'),
      COALESCE((v_line_items->0->>'name'), v_order.service_type, 'Service'),
      COALESCE((v_line_items->0->>'price')::numeric, v_order.subtotal, v_order.total_amount, 0),
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '30 days',
      'active',
      p_order_id,
      CASE WHEN v_category IN ('internet', 'tv', 'combo') THEN v_address_id ELSE NULL END,
      v_category
    ) RETURNING id INTO v_sub_id;

    v_services_created := v_services_created + 1;
  ELSE
    UPDATE public.billing_subscriptions
    SET
      address_id = CASE
        WHEN v_category IN ('internet', 'tv', 'combo') AND address_id IS NULL THEN v_address_id
        ELSE address_id
      END,
      service_category = COALESCE(NULLIF(service_category, ''), v_category),
      updated_at = now()
    WHERE id = v_sub_id;
  END IF;

  -- Sync service rows for this subscription (recurring + equipment one_time)
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_line_items)
  LOOP
    v_item_type := lower(COALESCE(v_item->>'type', 'service'));
    v_item_category := lower(COALESCE(v_item->>'category', v_item_type));

    -- Ignore non-service financial artifacts
    IF v_item_type IN ('discount', 'credit', 'tax') OR v_item_category IN ('discount', 'credit', 'tax') THEN
      CONTINUE;
    END IF;

    v_service_row_type := CASE
      WHEN v_item_type IN ('equipment', 'device', 'sim', 'esim', 'router', 'modem', 'tv_box', 'terminal', 'one_time')
        OR v_item_category IN ('equipment', 'device', 'sim', 'esim', 'router', 'modem', 'tv_box', 'terminal', 'one_time')
      THEN 'one_time'
      ELSE 'recurring'
    END;

    INSERT INTO public.billing_subscription_services (
      subscription_id,
      service_code,
      service_name,
      service_type,
      unit_price,
      quantity,
      is_active,
      added_at
    ) VALUES (
      v_sub_id,
      COALESCE(v_item->>'code', v_item->>'sku', v_item->>'type', 'item'),
      COALESCE(v_item->>'name', v_item->>'description', 'Service'),
      v_service_row_type,
      COALESCE((v_item->>'price')::numeric, (v_item->>'unit_price')::numeric, 0),
      GREATEST(COALESCE((v_item->>'quantity')::int, 1), 1),
      true,
      now()
    ) ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN
      v_inserted_services := v_inserted_services + 1;
    END IF;
  END LOOP;

  -- Hard fallback: ensure at least one recurring service row exists
  IF NOT EXISTS (
    SELECT 1 FROM public.billing_subscription_services bss
    WHERE bss.subscription_id = v_sub_id
      AND bss.is_active = true
  ) THEN
    INSERT INTO public.billing_subscription_services (
      subscription_id,
      service_code,
      service_name,
      service_type,
      unit_price,
      quantity,
      is_active,
      added_at
    ) VALUES (
      v_sub_id,
      COALESCE(v_order.service_type, 'service'),
      COALESCE(v_order.service_type, 'Service'),
      'recurring',
      COALESCE(v_order.subtotal, v_order.total_amount, 0),
      1,
      true,
      now()
    ) ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN
      v_inserted_services := v_inserted_services + 1;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'services_created', v_services_created,
    'service_rows_inserted', v_inserted_services,
    'subscription_id', v_sub_id,
    'address_id', v_address_id,
    'category', v_category
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_SERVICE_AT_ADDRESS',
      'message', 'Un service de cette catégorie est déjà actif à cette adresse.'
    );
END;
$$;

-- Always provision on lifecycle completion transitions (not only when line_items exist)
CREATE OR REPLACE FUNCTION public.trg_provision_on_order_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NEW.status IN ('completed', 'installation_completed', 'activated', 'delivered')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('completed', 'installation_completed', 'activated', 'delivered')) THEN
    v_result := public.provision_services_for_order(NEW.id);

    IF NOT COALESCE((v_result->>'success')::boolean, false) THEN
      INSERT INTO public.billing_system_alerts (alert_type, entity_type, entity_id, details)
      VALUES (
        'provisioning_failed',
        'order',
        NEW.id::text,
        jsonb_build_object(
          'order_number', NEW.order_number,
          'error', v_result->>'error',
          'attempted_status', NEW.status,
          'user_id', NEW.user_id,
          'result', v_result
        )
      );

      IF NEW.status IN ('completed', 'installation_completed') THEN
        NEW.status := 'provisioning_failed';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;