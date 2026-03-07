-- 1) Channel selections must be linked to exact order (global, not latest-by-user)
ALTER TABLE public.channel_selections
ADD COLUMN IF NOT EXISTS order_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'channel_selections_order_id_fkey'
      AND conrelid = 'public.channel_selections'::regclass
  ) THEN
    ALTER TABLE public.channel_selections
    ADD CONSTRAINT channel_selections_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_selections_order_unique
ON public.channel_selections(order_id)
WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_channel_selections_user_order
ON public.channel_selections(user_id, order_id);

-- 2) Utility: compute monthly total from channels jsonb
CREATE OR REPLACE FUNCTION public.compute_channels_total(_channels jsonb)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(COALESCE((item->>'price')::numeric, 0)), 0)
  FROM jsonb_array_elements(COALESCE(_channels, '[]'::jsonb)) item
$$;

-- 3) Canonical sync from orders.selected_channels -> channel_selections
CREATE OR REPLACE FUNCTION public.sync_channel_selection_from_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_tv boolean;
  v_status text;
BEGIN
  v_is_tv := (
    lower(COALESCE(NEW.service_type, '')) LIKE '%tv%'
    OR lower(COALESCE(NEW.service_type, '')) LIKE '%combo%'
    OR lower(COALESCE(NEW.service_type, '')) LIKE '%bundle%'
    OR lower(COALESCE(NEW.service_type, '')) LIKE '%giga%'
  );

  IF NOT v_is_tv THEN
    RETURN NEW;
  END IF;

  IF NEW.selected_channels IS NULL OR jsonb_typeof(NEW.selected_channels) <> 'array' THEN
    RETURN NEW;
  END IF;

  v_status := CASE
    WHEN NEW.status IN ('activated', 'completed', 'installation_completed', 'delivered') THEN 'activated'
    WHEN COALESCE(NEW.channel_selection_locked, false) THEN 'confirmed'
    ELSE 'pending'
  END;

  INSERT INTO public.channel_selections (
    user_id,
    order_id,
    channels,
    total_price,
    status,
    confirmed_at,
    confirmed_by,
    updated_at
  ) VALUES (
    NEW.user_id,
    NEW.id,
    NEW.selected_channels,
    public.compute_channels_total(NEW.selected_channels),
    v_status,
    CASE WHEN v_status IN ('confirmed', 'activated') THEN now() ELSE NULL END,
    CASE WHEN v_status IN ('confirmed', 'activated') THEN COALESCE(NEW.channel_assigned_by, 'system') ELSE NULL END,
    now()
  )
  ON CONFLICT (order_id)
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    channels = EXCLUDED.channels,
    total_price = EXCLUDED.total_price,
    status = CASE
      WHEN channel_selections.status = 'activated' THEN 'activated'
      ELSE EXCLUDED.status
    END,
    confirmed_at = CASE
      WHEN channel_selections.status = 'activated' THEN channel_selections.confirmed_at
      WHEN EXCLUDED.status IN ('confirmed', 'activated') THEN COALESCE(channel_selections.confirmed_at, now())
      ELSE channel_selections.confirmed_at
    END,
    confirmed_by = CASE
      WHEN channel_selections.status = 'activated' THEN channel_selections.confirmed_by
      WHEN EXCLUDED.status IN ('confirmed', 'activated') THEN COALESCE(EXCLUDED.confirmed_by, channel_selections.confirmed_by, 'system')
      ELSE channel_selections.confirmed_by
    END,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_channel_selection_from_order ON public.orders;
CREATE TRIGGER trg_sync_channel_selection_from_order
AFTER INSERT OR UPDATE OF selected_channels, service_type, channel_selection_locked, channel_assigned_by, status
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_channel_selection_from_order();

-- 4) Keep channel selection activation in sync with order lifecycle
CREATE OR REPLACE FUNCTION public.sync_channel_selection_activation_from_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_tv boolean;
BEGIN
  v_is_tv := (
    lower(COALESCE(NEW.service_type, '')) LIKE '%tv%'
    OR lower(COALESCE(NEW.service_type, '')) LIKE '%combo%'
    OR lower(COALESCE(NEW.service_type, '')) LIKE '%bundle%'
    OR lower(COALESCE(NEW.service_type, '')) LIKE '%giga%'
  );

  IF NOT v_is_tv THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('activated', 'completed', 'installation_completed', 'delivered') THEN
    UPDATE public.channel_selections
    SET
      status = 'activated',
      confirmed_at = COALESCE(confirmed_at, now()),
      confirmed_by = COALESCE(confirmed_by, NEW.channel_assigned_by, 'system'),
      updated_at = now()
    WHERE order_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_channel_selection_activation_on_status ON public.orders;
CREATE TRIGGER trg_sync_channel_selection_activation_on_status
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_channel_selection_activation_from_order_status();

-- 5) Keep billing_customers.user_id linked for client-portal RLS/payment history
CREATE OR REPLACE FUNCTION public.link_billing_customer_user_from_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_id IS NULL OR NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.billing_customers bc
  SET user_id = o.user_id,
      updated_at = now()
  FROM public.orders o
  WHERE bc.id = NEW.customer_id
    AND o.id = NEW.order_id
    AND o.user_id IS NOT NULL
    AND (bc.user_id IS NULL OR bc.user_id <> o.user_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_billing_customer_user_from_invoice ON public.billing_invoices;
CREATE TRIGGER trg_link_billing_customer_user_from_invoice
AFTER INSERT OR UPDATE OF order_id, customer_id ON public.billing_invoices
FOR EACH ROW
EXECUTE FUNCTION public.link_billing_customer_user_from_invoice();

CREATE OR REPLACE FUNCTION public.link_billing_customer_user_from_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.billing_customers bc
  SET user_id = NEW.user_id,
      updated_at = now()
  FROM public.billing_invoices bi
  WHERE bi.order_id = NEW.id
    AND bi.customer_id = bc.id
    AND NEW.user_id IS NOT NULL
    AND (bc.user_id IS NULL OR bc.user_id <> NEW.user_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_billing_customer_user_from_order ON public.orders;
CREATE TRIGGER trg_link_billing_customer_user_from_order
AFTER INSERT OR UPDATE OF user_id ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.link_billing_customer_user_from_order();

-- 6) Canonical provisioning function: remove broken line_items reference and enforce category/address sync
CREATE OR REPLACE FUNCTION public.provision_services_for_order(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Canonical/fallback line items (orders table has no line_items column)
  v_line_items := COALESCE(
    v_order.equipment_details->'line_items',
    v_order.pricing_snapshot->'line_items',
    v_order.equipment_line_details
  );

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
    WHEN v_order.service_type ILIKE '%internet%' THEN 'Internet'
    WHEN v_order.service_type ILIKE '%tv%' OR v_order.service_type ILIKE '%télé%' THEN 'TV'
    WHEN v_order.service_type ILIKE '%combo%' OR v_order.service_type ILIKE '%bundle%' THEN 'TV'
    WHEN v_order.service_type ILIKE '%mobile%' OR v_order.service_type ILIKE '%cell%' THEN 'Mobile'
    WHEN v_order.service_type ILIKE '%streaming%' THEN 'Streaming'
    ELSE 'Other'
  END;

  IF lower(v_category) IN ('internet', 'tv') THEN
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

    IF v_address_hash IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.billing_subscriptions bs
      JOIN public.service_addresses sa ON sa.id = bs.address_id
      WHERE bs.customer_id = v_customer_id
        AND lower(COALESCE(bs.service_category, '')) = lower(v_category)
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
      CASE WHEN lower(v_category) IN ('internet', 'tv') THEN v_address_id ELSE NULL END,
      v_category
    ) RETURNING id INTO v_sub_id;

    v_services_created := v_services_created + 1;
  ELSE
    UPDATE public.billing_subscriptions
    SET
      address_id = CASE
        WHEN lower(v_category) IN ('internet', 'tv') AND address_id IS NULL THEN v_address_id
        ELSE address_id
      END,
      service_category = COALESCE(NULLIF(service_category, ''), v_category),
      status = CASE
        WHEN status IN ('pending', 'suspended') THEN 'active'::billing_subscription_status
        ELSE status
      END,
      updated_at = now()
    WHERE id = v_sub_id;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_line_items)
  LOOP
    v_item_type := lower(COALESCE(v_item->>'type', 'service'));
    v_item_category := lower(COALESCE(v_item->>'category', v_item_type));

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
$function$;