-- Helper: resolve/create a service address for residential subscriptions
CREATE OR REPLACE FUNCTION public.resolve_or_create_service_address(
  p_customer_id uuid,
  p_order_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_account_id uuid;
  v_address_id uuid;
  v_address_line text;
  v_city text;
  v_province text;
  v_postal_code text;
  v_hash text;
  v_has_default boolean;
BEGIN
  SELECT bc.user_id INTO v_user_id
  FROM public.billing_customers bc
  WHERE bc.id = p_customer_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT a.id INTO v_account_id
  FROM public.accounts a
  WHERE a.client_id = v_user_id
  LIMIT 1;

  IF v_account_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1) Canonical source: order shipping fields
  IF p_order_id IS NOT NULL THEN
    SELECT
      NULLIF(TRIM(o.shipping_address), ''),
      NULLIF(TRIM(o.shipping_city), ''),
      NULLIF(TRIM(o.shipping_province), ''),
      NULLIF(TRIM(o.shipping_postal_code), '')
    INTO v_address_line, v_city, v_province, v_postal_code
    FROM public.orders o
    WHERE o.id = p_order_id
    LIMIT 1;

    -- 1b) Order invoice snapshot fallback
    IF v_address_line IS NULL THEN
      SELECT
        NULLIF(TRIM(COALESCE(
          bi.address_snapshot->>'address_line',
          bi.address_snapshot->>'address',
          bi.address_snapshot->>'full_service_address'
        )), ''),
        NULLIF(TRIM(bi.address_snapshot->>'city'), ''),
        NULLIF(TRIM(bi.address_snapshot->>'province'), ''),
        NULLIF(TRIM(COALESCE(
          bi.address_snapshot->>'postal_code',
          bi.address_snapshot->>'postal'
        )), '')
      INTO v_address_line, v_city, v_province, v_postal_code
      FROM public.billing_invoices bi
      WHERE bi.order_id = p_order_id
      ORDER BY bi.created_at DESC NULLS LAST
      LIMIT 1;
    END IF;
  END IF;

  -- 2) Customer latest invoice snapshot fallback
  IF v_address_line IS NULL THEN
    SELECT
      NULLIF(TRIM(COALESCE(
        bi.address_snapshot->>'address_line',
        bi.address_snapshot->>'address',
        bi.address_snapshot->>'full_service_address'
      )), ''),
      NULLIF(TRIM(bi.address_snapshot->>'city'), ''),
      NULLIF(TRIM(bi.address_snapshot->>'province'), ''),
      NULLIF(TRIM(COALESCE(
        bi.address_snapshot->>'postal_code',
        bi.address_snapshot->>'postal'
      )), '')
    INTO v_address_line, v_city, v_province, v_postal_code
    FROM public.billing_invoices bi
    WHERE bi.customer_id = p_customer_id
      AND bi.address_snapshot IS NOT NULL
    ORDER BY bi.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  -- 3) Account primary address fallback
  IF v_address_line IS NULL THEN
    SELECT
      NULLIF(TRIM(a.primary_service_address), ''),
      NULLIF(TRIM(a.primary_service_city), ''),
      NULLIF(TRIM(a.primary_service_province), ''),
      NULLIF(TRIM(a.primary_service_postal_code), '')
    INTO v_address_line, v_city, v_province, v_postal_code
    FROM public.accounts a
    WHERE a.id = v_account_id
    LIMIT 1;
  END IF;

  -- 4) Final hard fallback (prevents null residential address)
  IF v_address_line IS NULL THEN
    v_address_line := 'Adresse principale à confirmer';
  END IF;

  v_province := COALESCE(NULLIF(TRIM(v_province), ''), 'QC');

  v_hash := public.compute_address_hash(v_address_line, v_city, v_province, v_postal_code);

  -- Reuse existing active address by hash first
  IF v_hash IS NOT NULL THEN
    SELECT sa.id INTO v_address_id
    FROM public.service_addresses sa
    WHERE sa.account_id = v_account_id
      AND sa.is_active = true
      AND sa.address_hash = v_hash
    LIMIT 1;
  END IF;

  IF v_address_id IS NOT NULL THEN
    RETURN v_address_id;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.service_addresses sa
    WHERE sa.account_id = v_account_id
      AND sa.is_active = true
      AND sa.is_default = true
  ) INTO v_has_default;

  BEGIN
    INSERT INTO public.service_addresses (
      account_id,
      label,
      address_line,
      city,
      province,
      postal_code,
      is_default,
      is_active
    ) VALUES (
      v_account_id,
      COALESCE(v_city, 'Adresse principale'),
      v_address_line,
      v_city,
      v_province,
      v_postal_code,
      CASE WHEN v_has_default THEN false ELSE true END,
      true
    )
    RETURNING id INTO v_address_id;
  EXCEPTION
    WHEN unique_violation THEN
      -- Race-safe fallback if unique hash/index collided
      SELECT sa.id INTO v_address_id
      FROM public.service_addresses sa
      WHERE sa.account_id = v_account_id
        AND sa.is_active = true
        AND sa.address_hash = v_hash
      LIMIT 1;
  END;

  RETURN v_address_id;
END;
$$;

-- Trigger guard: residential subscriptions must always have an address_id
CREATE OR REPLACE FUNCTION public.trg_ensure_residential_subscription_address()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_resolved uuid;
BEGIN
  IF lower(COALESCE(NEW.service_category, '')) IN ('internet', 'tv', 'combo') THEN
    IF NEW.address_id IS NULL THEN
      v_resolved := public.resolve_or_create_service_address(NEW.customer_id, NEW.order_id);
      NEW.address_id := v_resolved;
    END IF;

    IF NEW.address_id IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'ADDRESS_REQUIRED',
        DETAIL = 'Residential subscriptions (internet/tv/combo) require address_id';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_residential_subscription_address ON public.billing_subscriptions;
CREATE TRIGGER ensure_residential_subscription_address
BEFORE INSERT OR UPDATE OF address_id, service_category, order_id, customer_id
ON public.billing_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.trg_ensure_residential_subscription_address();

-- Canonical provisioning update: use shipping_* fields + resolver + hash-level duplicate guard
CREATE OR REPLACE FUNCTION public.provision_services_for_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_order record;
  v_customer_id uuid;
  v_line_items jsonb;
  v_item jsonb;
  v_sub_id uuid;
  v_services_created int := 0;
  v_category text;
  v_address_id uuid;
  v_address_hash text;
  v_address_snapshot jsonb;
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

  v_line_items := v_order.line_items;
  IF v_line_items IS NULL OR jsonb_array_length(v_line_items) = 0 THEN
    RETURN jsonb_build_object('success', true, 'services_created', 0, 'note', 'No line items');
  END IF;

  v_category := CASE
    WHEN v_order.service_type ILIKE '%internet%' THEN 'internet'
    WHEN v_order.service_type ILIKE '%tv%' OR v_order.service_type ILIKE '%télé%' THEN 'tv'
    WHEN v_order.service_type ILIKE '%combo%' OR v_order.service_type ILIKE '%bundle%' THEN 'combo'
    WHEN v_order.service_type ILIKE '%mobile%' OR v_order.service_type ILIKE '%cell%' THEN 'mobile'
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

    -- Hash-level duplicate guard (same physical address written differently)
    IF v_address_hash IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.billing_subscriptions bs
      JOIN public.service_addresses sa ON sa.id = bs.address_id
      WHERE bs.customer_id = v_customer_id
        AND lower(COALESCE(bs.service_category, '')) = v_category
        AND bs.status::text NOT IN ('cancelled', 'expired')
        AND sa.address_hash = v_address_hash
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'DUPLICATE_SERVICE_AT_ADDRESS',
        'message', 'Un service Internet est déjà actif ou en cours à cette adresse.'
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

  IF NOT EXISTS (
    SELECT 1 FROM public.billing_subscriptions
    WHERE order_id = p_order_id
      AND customer_id = v_customer_id
  ) THEN
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
      COALESCE((v_line_items->0->>'price')::numeric, v_order.subtotal, 0),
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '30 days',
      'active',
      p_order_id,
      CASE WHEN v_category IN ('internet', 'tv', 'combo') THEN v_address_id ELSE NULL END,
      v_category
    ) RETURNING id INTO v_sub_id;

    v_services_created := v_services_created + 1;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_line_items)
    LOOP
      IF (v_item->>'type') IN ('plan', 'service', 'equipment', 'option') THEN
        INSERT INTO public.billing_subscription_services (
          subscription_id,
          service_code,
          service_name,
          service_type,
          unit_price,
          quantity,
          is_active
        ) VALUES (
          v_sub_id,
          COALESCE(v_item->>'code', v_item->>'type', 'item'),
          COALESCE(v_item->>'name', 'Service'),
          COALESCE(v_item->>'type', 'plan'),
          COALESCE((v_item->>'price')::numeric, 0),
          COALESCE((v_item->>'quantity')::int, 1),
          true
        ) ON CONFLICT DO NOTHING;
        v_services_created := v_services_created + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'services_created', v_services_created,
    'subscription_id', v_sub_id,
    'address_id', v_address_id,
    'category', v_category
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_SERVICE_AT_ADDRESS',
      'message', 'Un service Internet est déjà actif ou en cours à cette adresse.'
    );
END;
$function$;