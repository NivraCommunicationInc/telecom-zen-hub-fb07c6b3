CREATE OR REPLACE FUNCTION public.provision_services_for_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order record;
  v_customer_id uuid;
  v_sub_id uuid;
  v_created int := 0;
  v_updated int := 0;
  v_service_rows int := 0;
  v_address_id uuid;
  v_address_hash text;
  v_address_snapshot jsonb;
  v_rows int := 0;

  v_item record;
  v_item_name text;
  v_item_code text;
  v_item_price numeric;
  v_item_qty int;
  v_item_service_category text;
  v_needs_address boolean;

  v_activation_date date;
  v_anchor_day int;
  v_days_in_month int;
  v_anchor_candidate date;
  v_cycle_end date;
  v_next_renewal timestamptz;
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

  v_activation_date := COALESCE(v_order.service_activated_at::date, CURRENT_DATE);

  SELECT COALESCE(a.billing_anchor_day, a.billing_cycle_day)
    INTO v_anchor_day
  FROM public.accounts a
  WHERE (v_order.account_id IS NOT NULL AND a.id = v_order.account_id)
     OR (v_order.account_id IS NULL AND a.client_id = v_order.user_id)
  ORDER BY CASE WHEN v_order.account_id IS NOT NULL AND a.id = v_order.account_id THEN 0 ELSE 1 END,
           CASE WHEN a.status = 'active' THEN 0 ELSE 1 END,
           a.created_at DESC
  LIMIT 1;

  v_anchor_day := GREATEST(1, LEAST(31, COALESCE(v_anchor_day, EXTRACT(DAY FROM v_activation_date)::int)));
  v_days_in_month := EXTRACT(DAY FROM (date_trunc('month', v_activation_date)::date + INTERVAL '1 month - 1 day'))::int;
  v_anchor_candidate := make_date(
    EXTRACT(YEAR FROM v_activation_date)::int,
    EXTRACT(MONTH FROM v_activation_date)::int,
    LEAST(v_anchor_day, v_days_in_month)
  );

  IF v_anchor_candidate <= v_activation_date THEN
    v_days_in_month := EXTRACT(DAY FROM (date_trunc('month', v_activation_date)::date + INTERVAL '2 month - 1 day'))::int;
    v_anchor_candidate := make_date(
      EXTRACT(YEAR FROM (v_activation_date + INTERVAL '1 month'))::int,
      EXTRACT(MONTH FROM (v_activation_date + INTERVAL '1 month'))::int,
      LEAST(v_anchor_day, v_days_in_month)
    );
  END IF;

  v_cycle_end := (v_anchor_candidate - INTERVAL '1 day')::date;
  v_next_renewal := v_anchor_candidate::timestamptz;

  FOR v_item IN
    SELECT *
    FROM public.order_items
    WHERE order_id = p_order_id
      AND is_recurring = true
      AND COALESCE(unit_price, line_total, 0) > 0
    ORDER BY item_number, created_at
  LOOP
    v_item_name := COALESCE(v_item.plan_name, v_item.description, 'Service');
    v_item_code := COALESCE(v_item.plan_code, v_item.service_type::text, lower(regexp_replace(v_item_name, '[^a-zA-Z0-9]+', '_', 'g')));
    v_item_price := COALESCE(v_item.unit_price, v_item.line_total, 0);
    v_item_qty := GREATEST(COALESCE(v_item.quantity, 1), 1);
    v_item_service_category := COALESCE(NULLIF(initcap(v_item.service_type::text), ''), 'Service');
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
    WHERE bs.source_order_item_id = v_item.id
       OR (bs.order_id = p_order_id AND bs.customer_id = v_customer_id AND bs.plan_code = v_item_code)
    ORDER BY CASE WHEN bs.source_order_item_id = v_item.id THEN 0 ELSE 1 END, bs.created_at DESC NULLS LAST
    LIMIT 1
    FOR UPDATE;

    IF v_sub_id IS NULL THEN
      INSERT INTO public.billing_subscriptions (
        customer_id, plan_code, plan_name, plan_price,
        cycle_start_date, cycle_end_date, status, order_id,
        address_id, service_category, billing_cycle_anchor, next_renewal_at,
        source_order_item_id, frozen_name, frozen_code, frozen_unit_price,
        frozen_currency, frozen_cycle, frozen_frequency, frozen_anchor_date,
        source_type, source_id, environment, auto_billing_enabled
      ) VALUES (
        v_customer_id,
        v_item_code,
        v_item_name,
        v_item_price,
        v_activation_date,
        v_cycle_end,
        'active',
        p_order_id,
        CASE WHEN v_needs_address THEN v_address_id ELSE NULL END,
        v_item_service_category,
        v_activation_date::timestamptz,
        v_next_renewal,
        v_item.id,
        v_item_name,
        v_item_code,
        v_item_price,
        'CAD',
        'monthly',
        'monthly',
        v_activation_date,
        'order_item',
        v_item.id::text,
        'live',
        true
      ) RETURNING id INTO v_sub_id;
      v_created := v_created + 1;
    ELSE
      UPDATE public.billing_subscriptions
      SET plan_code = v_item_code,
          plan_name = v_item_name,
          plan_price = v_item_price,
          service_category = v_item_service_category,
          cycle_start_date = COALESCE(cycle_start_date, v_activation_date),
          cycle_end_date = v_cycle_end,
          billing_cycle_anchor = COALESCE(billing_cycle_anchor, v_activation_date::timestamptz),
          next_renewal_at = v_next_renewal,
          address_id = CASE WHEN v_needs_address AND address_id IS NULL THEN v_address_id ELSE address_id END,
          status = CASE WHEN status IN ('pending','suspended') THEN 'active'::billing_subscription_status ELSE status END,
          auto_billing_enabled = true,
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

  IF v_created = 0 AND v_updated = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'skipped', 'no_recurring_service',
      'subscriptions_created', 0,
      'subscriptions_updated', 0,
      'service_rows_inserted', 0
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'subscriptions_created', v_created,
    'subscriptions_updated', v_updated,
    'service_rows_inserted', v_service_rows,
    'address_id', v_address_id,
    'cycle_end_date', v_cycle_end,
    'next_renewal_at', v_next_renewal
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