
CREATE OR REPLACE FUNCTION public.provision_services_for_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order record;
  v_customer_id uuid;
  v_line_items jsonb;
  v_item jsonb;
  v_recurring_lines jsonb := '[]'::jsonb;
  v_sub_id uuid;
  v_created int := 0;
  v_updated int := 0;
  v_service_rows int := 0;
  v_address_id uuid;
  v_address_hash text;
  v_address_snapshot jsonb;
  v_rows int := 0;

  v_item_type text;
  v_item_category text;
  v_item_period text;
  v_item_name text;
  v_item_code text;
  v_item_price numeric;
  v_item_qty int;
  v_has_flag boolean;
  v_flag_value boolean;
  v_include boolean;
  v_item_cycle_days int;
  v_item_service_category text;
  v_needs_address boolean;
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

  v_line_items := COALESCE(
    v_order.equipment_details->'line_items',
    v_order.pricing_snapshot->'line_items',
    v_order.equipment_line_details,
    '[]'::jsonb
  );

  IF v_line_items IS NULL OR jsonb_typeof(v_line_items) <> 'array' OR jsonb_array_length(v_line_items) = 0 THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'name', bil.description,
      'unit_price', bil.unit_price,
      'quantity', bil.quantity,
      'type', 'service',
      'category', COALESCE(bil.metadata->>'category', 'service'),
      'period', COALESCE(bil.metadata->>'period', 'monthly'),
      'is_recurring', true,
      'code', COALESCE(bil.metadata->>'plan_code', bil.metadata->>'service_code')
    )), '[]'::jsonb) INTO v_line_items
    FROM public.billing_invoice_lines bil
    JOIN public.billing_invoices bi ON bi.id = bil.invoice_id
    WHERE bi.order_id = p_order_id
      AND bil.line_type = 'service'
      AND COALESCE(bil.unit_price, bil.line_total, 0) > 0;
  END IF;

  -- Selection rule:
  -- 1) If the line explicitly carries an `is_recurring` boolean, that value is authoritative.
  -- 2) Otherwise (legacy lines without the flag), fall back to period/category heuristics.
  -- Categories NEVER override an explicit is_recurring=false.
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_line_items)
  LOOP
    v_item_type := lower(COALESCE(v_item->>'type', ''));
    v_item_category := lower(COALESCE(v_item->>'category', v_item_type));
    v_item_period := lower(COALESCE(v_item->>'period', v_item->>'billing_period', ''));
    v_item_name := lower(COALESCE(v_item->>'name', v_item->>'description', ''));

    v_has_flag := (v_item ? 'is_recurring') AND jsonb_typeof(v_item->'is_recurring') = 'boolean';
    v_flag_value := CASE WHEN v_has_flag THEN (v_item->>'is_recurring')::boolean ELSE false END;

    IF v_has_flag THEN
      v_include := v_flag_value;
    ELSE
      -- Legacy fallback: hard-exclude non-recurring types, then require monthly period
      -- or a known recurring category to include.
      IF v_item_type IN ('discount','credit','tax','fee','shipping','delivery','equipment','device','sim','esim','router','modem','tv_box','terminal','one_time','deplacement','installation','activation','accessory','adjustment','promotion')
         OR v_item_category IN ('discount','credit','tax','fee','shipping','delivery','equipment','device','sim','esim','router','modem','tv_box','terminal','one_time','deplacement','installation','activation','accessory','adjustment','promotion')
         OR v_item_name LIKE '%livraison%'
         OR v_item_name LIKE '%deplacement%'
         OR v_item_name LIKE '%déplacement%'
         OR v_item_name LIKE '%activation%'
         OR v_item_name LIKE '%frais unique%'
      THEN
        v_include := false;
      ELSIF v_item_period IN ('monthly','month','recurring','mensuel','30_days','30d','yearly','year','annual')
         OR v_item_category IN ('service','plan','subscription','internet','tv','mobile','streaming','combo','security')
      THEN
        v_include := true;
      ELSE
        v_include := false;
      END IF;
    END IF;

    IF NOT v_include THEN CONTINUE; END IF;

    IF COALESCE((v_item->>'price')::numeric, (v_item->>'unit_price')::numeric, 0) <= 0 THEN
      CONTINUE;
    END IF;

    v_recurring_lines := v_recurring_lines || jsonb_build_array(v_item);
  END LOOP;

  IF jsonb_array_length(v_recurring_lines) = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'skipped', 'no_recurring_service',
      'subscriptions_created', 0,
      'subscriptions_updated', 0,
      'service_rows_inserted', 0
    );
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_recurring_lines)
  LOOP
    v_item_type := lower(COALESCE(v_item->>'type', ''));
    v_item_category := lower(COALESCE(v_item->>'category', v_item_type));
    v_item_period := lower(COALESCE(v_item->>'period', v_item->>'billing_period', 'monthly'));
    v_item_name := COALESCE(v_item->>'name', v_item->>'description', 'Service');
    v_item_code := COALESCE(v_item->>'code', v_item->>'sku', v_item->>'plan_code', v_item->>'ref_id',
      lower(regexp_replace(v_item_name, '[^a-zA-Z0-9]+', '_', 'g')));
    v_item_price := COALESCE((v_item->>'price')::numeric, (v_item->>'unit_price')::numeric, 0);
    v_item_qty := GREATEST(COALESCE((v_item->>'quantity')::int, 1), 1);
    v_item_cycle_days := COALESCE((v_item->>'cycle_days')::int,
      CASE lower(v_item_period)
        WHEN 'yearly' THEN 365
        WHEN 'year' THEN 365
        WHEN 'annual' THEN 365
        ELSE 30
      END);

    -- Category is a CLASSIFICATION label only; it does not gate subscription creation.
    -- Trust the line's own category first; only infer from the name when absent.
    v_item_service_category := COALESCE(
      NULLIF(v_item->>'service_category', ''),
      CASE
        WHEN v_item_category IN ('internet','tv','mobile','streaming','security','combo') THEN initcap(v_item_category)
        WHEN v_item_category ILIKE '%internet%' THEN 'Internet'
        WHEN v_item_category ILIKE '%tv%' OR v_item_category ILIKE '%tele%' THEN 'TV'
        WHEN v_item_category ILIKE '%mobile%' OR v_item_category ILIKE '%cell%' THEN 'Mobile'
        WHEN v_item_category ILIKE '%streaming%' THEN 'Streaming'
        WHEN v_item_category ILIKE '%security%' THEN 'Security'
        ELSE NULLIF(initcap(v_item_category), '')
      END,
      'Service'
    );

    v_needs_address := lower(v_item_service_category) IN ('internet','tv');

    IF v_needs_address AND v_address_id IS NULL THEN
      v_address_id := public.resolve_or_create_service_address(v_customer_id, p_order_id);
      IF v_address_id IS NULL THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'ADDRESS_REQUIRED',
          'message', 'Une adresse de service est requise pour Internet/TV.'
        );
      END IF;

      SELECT sa.address_hash INTO v_address_hash
      FROM public.service_addresses sa WHERE sa.id = v_address_id LIMIT 1;

      IF v_address_hash IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.billing_subscriptions bs
        JOIN public.service_addresses sa ON sa.id = bs.address_id
        WHERE bs.customer_id = v_customer_id
          AND lower(COALESCE(bs.service_category, '')) = lower(v_item_service_category)
          AND bs.status::text IN ('active','pending','suspended')
          AND sa.address_hash = v_address_hash
          AND bs.order_id IS DISTINCT FROM p_order_id
      ) THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'DUPLICATE_SERVICE_AT_ADDRESS',
          'message', 'Un service de cette catégorie est déjà actif à cette adresse.'
        );
      END IF;

      SELECT jsonb_build_object(
        'address_id', sa.id,
        'label', sa.label,
        'address_line', sa.address_line,
        'city', sa.city,
        'province', sa.province,
        'postal_code', sa.postal_code,
        'snapshot_at', now()
      ) INTO v_address_snapshot
      FROM public.service_addresses sa WHERE sa.id = v_address_id;

      UPDATE public.billing_invoices
      SET address_snapshot = v_address_snapshot
      WHERE order_id = p_order_id AND address_snapshot IS NULL;
    END IF;

    SELECT bs.id INTO v_sub_id
    FROM public.billing_subscriptions bs
    WHERE bs.order_id = p_order_id
      AND bs.customer_id = v_customer_id
      AND bs.plan_code = v_item_code
    ORDER BY bs.created_at DESC NULLS LAST
    LIMIT 1
    FOR UPDATE;

    IF v_sub_id IS NULL THEN
      INSERT INTO public.billing_subscriptions (
        customer_id, plan_code, plan_name, plan_price,
        cycle_start_date, cycle_end_date, status, order_id,
        address_id, service_category
      ) VALUES (
        v_customer_id,
        v_item_code,
        v_item_name,
        v_item_price,
        CURRENT_DATE,
        CURRENT_DATE + (v_item_cycle_days || ' days')::interval,
        'active',
        p_order_id,
        CASE WHEN v_needs_address THEN v_address_id ELSE NULL END,
        v_item_service_category
      ) RETURNING id INTO v_sub_id;
      v_created := v_created + 1;
    ELSE
      UPDATE public.billing_subscriptions
      SET plan_code = v_item_code,
          plan_name = v_item_name,
          plan_price = v_item_price,
          service_category = v_item_service_category,
          cycle_end_date = COALESCE(cycle_end_date, CURRENT_DATE + (v_item_cycle_days || ' days')::interval),
          address_id = CASE WHEN v_needs_address AND address_id IS NULL THEN v_address_id ELSE address_id END,
          status = CASE WHEN status IN ('pending','suspended') THEN 'active'::billing_subscription_status ELSE status END,
          updated_at = now()
      WHERE id = v_sub_id;
      v_updated := v_updated + 1;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.billing_subscription_services bss
      WHERE bss.subscription_id = v_sub_id
        AND bss.service_code = v_item_code
        AND bss.is_active = true
    ) THEN
      INSERT INTO public.billing_subscription_services (
        subscription_id, service_code, service_name, service_type,
        unit_price, quantity, is_active, added_at
      ) VALUES (
        v_sub_id, v_item_code, v_item_name, 'recurring',
        v_item_price, v_item_qty, true, now()
      ) ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_service_rows := v_service_rows + v_rows;
    ELSE
      UPDATE public.billing_subscription_services
      SET service_name = v_item_name,
          unit_price = v_item_price,
          quantity = v_item_qty,
          updated_at = now()
      WHERE subscription_id = v_sub_id AND service_code = v_item_code AND is_active = true;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'subscriptions_created', v_created,
    'subscriptions_updated', v_updated,
    'service_rows_inserted', v_service_rows,
    'address_id', v_address_id
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_SERVICE_AT_ADDRESS',
      'message', 'Un service de cette catégorie est déjà actif à cette adresse.'
    );
END;
$function$;
