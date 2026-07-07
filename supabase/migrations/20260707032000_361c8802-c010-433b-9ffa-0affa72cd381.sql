
-- 1) Fix activation trigger: never mutate billing anchor fields on an existing account.
CREATE OR REPLACE FUNCTION public.fn_activate_sub_on_order_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_activation_date TIMESTAMPTZ;
  v_activation_day  INT;
  v_account_id      UUID;
  v_account_number  TEXT;
  v_customer_id     UUID;
  v_existing_sub_id UUID;
  v_plan            RECORD;
  v_profile         RECORD;
  v_client_email    TEXT;
  v_first_name      TEXT;
  v_last_name       TEXT;
  v_acct            RECORD;
BEGIN
  IF NEW.status NOT IN ('delivered', 'activated', 'completed') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_activation_date := COALESCE(NEW.service_activated_at, NOW());
  v_activation_day  := EXTRACT(DAY FROM v_activation_date)::INT;

  IF NEW.service_activated_at IS NULL AND NEW.status = 'activated' THEN
    NEW.service_activated_at := v_activation_date;
    NEW.service_activation_source := COALESCE(NEW.service_activation_source, 'trigger_auto_activated');
  END IF;

  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.* INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id
  LIMIT 1;

  v_client_email := lower(nullif(btrim(COALESCE(NEW.client_email, v_profile.email)), ''));
  v_first_name := COALESCE(NULLIF(NEW.client_first_name, ''), NULLIF(v_profile.first_name, ''), split_part(COALESCE(v_profile.full_name, 'Client Nivra'), ' ', 1), 'Client');
  v_last_name := COALESCE(NULLIF(NEW.client_last_name, ''), NULLIF(v_profile.last_name, ''), NULLIF(btrim(regexp_replace(COALESCE(v_profile.full_name, ''), '^\S+\s*', '')), ''), 'Nivra');

  v_account_id := NEW.account_id;

  IF v_account_id IS NULL THEN
    SELECT a.id, a.account_number INTO v_account_id, v_account_number
    FROM public.accounts a
    WHERE a.client_id = NEW.user_id
    ORDER BY CASE WHEN a.status = 'active' THEN 0 ELSE 1 END, a.created_at DESC
    LIMIT 1;
  ELSE
    SELECT a.account_number INTO v_account_number
    FROM public.accounts a
    WHERE a.id = v_account_id;
  END IF;

  IF v_account_id IS NULL THEN
    INSERT INTO public.accounts (
      client_id, account_name, status,
      billing_address, billing_city, billing_postal_code, billing_province,
      primary_service_address, primary_service_city, primary_service_postal_code, primary_service_province,
      billing_cycle_day, billing_anchor_date, next_invoice_date
    ) VALUES (
      NEW.user_id,
      COALESCE(NULLIF(v_profile.full_name, ''), btrim(v_first_name || ' ' || v_last_name), 'Client Nivra'),
      'active',
      NEW.shipping_address, NEW.shipping_city, NEW.shipping_postal_code, 'QC',
      NEW.shipping_address, NEW.shipping_city, NEW.shipping_postal_code, 'QC',
      v_activation_day, v_activation_date::date, (v_activation_date + INTERVAL '1 month')::date
    )
    RETURNING id, account_number INTO v_account_id, v_account_number;

    NEW.account_id := v_account_id;
  END IF;

  -- Reactivate account if needed and next_invoice_date if missing.
  -- IMPORTANT: never touch billing_cycle_day / billing_anchor_date / billing_anchor_day
  -- once the account exists — the protect_billing_anchor trigger rejects any change
  -- on accounts that already carry active/pending/suspended subscriptions.
  IF v_account_id IS NOT NULL THEN
    SELECT a.billing_cycle_day, a.billing_anchor_date, a.next_invoice_date, a.status
      INTO v_acct
    FROM public.accounts a
    WHERE a.id = v_account_id;

    UPDATE public.accounts a
    SET
      status = CASE WHEN a.status IN ('cancelled', 'suspended', 'pending') THEN 'active' ELSE a.status END,
      next_invoice_date = COALESCE(a.next_invoice_date, (v_activation_date + INTERVAL '1 month')::date),
      updated_at = NOW()
    WHERE a.id = v_account_id
    RETURNING a.account_number INTO v_account_number;

    -- Bootstrap anchor ONLY if it is completely missing (no active subs yet either).
    IF v_acct.billing_cycle_day IS NULL THEN
      BEGIN
        UPDATE public.accounts a
        SET billing_cycle_day = v_activation_day,
            billing_anchor_date = COALESCE(a.billing_anchor_date, v_activation_date::date)
        WHERE a.id = v_account_id;
      EXCEPTION WHEN check_violation THEN
        -- protected by active subs; anchor already effectively set — ignore.
        NULL;
      END;
    END IF;
  END IF;

  IF v_account_number IS NOT NULL THEN
    UPDATE public.profiles p
    SET account_number = v_account_number,
        updated_at = NOW()
    WHERE p.user_id = NEW.user_id
      AND p.account_number IS DISTINCT FROM v_account_number;
  END IF;

  SELECT bc.id INTO v_customer_id
  FROM public.billing_customers bc
  WHERE bc.user_id = NEW.user_id
     OR (v_client_email IS NOT NULL AND lower(btrim(bc.email)) = v_client_email)
  ORDER BY CASE WHEN bc.user_id = NEW.user_id THEN 0 ELSE 1 END, bc.created_at DESC
  LIMIT 1;

  IF v_customer_id IS NULL AND v_client_email IS NOT NULL THEN
    INSERT INTO public.billing_customers (user_id, first_name, last_name, email, phone, status)
    VALUES (NEW.user_id, v_first_name, v_last_name, v_client_email, COALESCE(NEW.client_phone, v_profile.phone, ''), 'active')
    RETURNING id INTO v_customer_id;
  ELSIF v_customer_id IS NOT NULL THEN
    UPDATE public.billing_customers
    SET user_id = COALESCE(user_id, NEW.user_id),
        status = COALESCE(status, 'active'),
        updated_at = NOW()
    WHERE id = v_customer_id;
  END IF;

  SELECT * INTO v_plan
  FROM public.fn_resolve_order_monthly_service(NEW)
  LIMIT 1;

  SELECT id INTO v_existing_sub_id
  FROM public.billing_subscriptions
  WHERE order_id = NEW.id
     OR (v_customer_id IS NOT NULL AND customer_id = v_customer_id AND status IN ('pending','active','suspended'))
  ORDER BY CASE WHEN order_id = NEW.id THEN 0 ELSE 1 END, created_at DESC
  LIMIT 1;

  IF v_existing_sub_id IS NOT NULL THEN
    UPDATE public.billing_subscriptions bs
    SET
      customer_id = COALESCE(bs.customer_id, v_customer_id),
      order_id = COALESCE(bs.order_id, NEW.id),
      status = CASE WHEN bs.status::text = 'cancelled' THEN bs.status ELSE 'active'::public.billing_subscription_status END,
      billing_cycle_anchor = COALESCE(bs.billing_cycle_anchor, v_activation_date),
      cycle_start_date = COALESCE(bs.cycle_start_date, v_activation_date::date),
      cycle_end_date = COALESCE(bs.cycle_end_date, (v_activation_date + INTERVAL '1 month')::date),
      next_renewal_at = COALESCE(bs.next_renewal_at, (v_activation_date + INTERVAL '1 month')),
      auto_billing_enabled = TRUE,
      plan_code = CASE
        WHEN v_plan.plan_code IS NOT NULL
             AND (COALESCE(bs.plan_code, '') IN ('', 'UNKNOWN', 'service', 'unknown')
                  OR length(bs.plan_code) > 60)
        THEN v_plan.plan_code
        ELSE bs.plan_code
      END,
      plan_name = CASE
        WHEN v_plan.plan_name IS NOT NULL
             AND (bs.plan_name IS NULL OR bs.plan_name = '' OR lower(bs.plan_name) IN ('internet','service'))
        THEN v_plan.plan_name
        ELSE bs.plan_name
      END,
      plan_price = CASE
        WHEN COALESCE(bs.plan_price, 0) <= 0 AND COALESCE(v_plan.plan_price, 0) > 0
        THEN v_plan.plan_price
        ELSE bs.plan_price
      END,
      service_category = COALESCE(bs.service_category, v_plan.service_category, NEW.category, NEW.service_type),
      environment = CASE WHEN bs.environment = 'production' THEN 'live' ELSE bs.environment END,
      source_type = COALESCE(bs.source_type, NEW.source, NEW.created_by),
      updated_at = NOW()
    WHERE bs.id = v_existing_sub_id;
  ELSIF v_customer_id IS NOT NULL AND COALESCE(v_plan.plan_price, 0) > 0 THEN
    -- Only create a subscription when a real recurring service exists
    INSERT INTO public.billing_subscriptions (
      customer_id, order_id, plan_code, plan_name, plan_price,
      status, cycle_start_date, cycle_end_date, billing_cycle_anchor,
      next_renewal_at, auto_billing_enabled, service_category, environment, source_type
    ) VALUES (
      v_customer_id, NEW.id,
      COALESCE(v_plan.plan_code, NEW.category, NEW.service_type, 'service'),
      COALESCE(v_plan.plan_name, NEW.service_type, 'Service Nivra'),
      v_plan.plan_price,
      'active',
      v_activation_date::date,
      (v_activation_date + INTERVAL '1 month')::date,
      v_activation_date,
      (v_activation_date + INTERVAL '1 month'),
      TRUE,
      COALESCE(v_plan.service_category, NEW.category, NEW.service_type),
      'live',
      COALESCE(NEW.source, NEW.created_by, 'order_activation')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.kyc_verifications k
    WHERE k.client_id = NEW.user_id
      AND (k.account_id = v_account_id OR k.account_id IS NULL)
  ) THEN
    INSERT INTO public.kyc_verifications (client_id, account_id, requested_id_type, reason, status, requested_by)
    VALUES (
      NEW.user_id,
      v_account_id,
      'government_id',
      'Vérification d''identité requise — commande ' || COALESCE(NEW.order_number::text, ''),
      'pending',
      COALESCE(NEW.created_by_agent_id, NEW.user_id)
    );
  ELSE
    UPDATE public.kyc_verifications
    SET account_id = COALESCE(account_id, v_account_id)
    WHERE client_id = NEW.user_id
      AND account_id IS NULL;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Fix provisioning RPC: only create subscription for real recurring services,
-- pull plan info from fn_resolve_order_monthly_service, and never insert equipment /
-- fee / delivery / one_time lines as billing_subscription_services.
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
  v_item_period text;
  v_item_name text;
  v_plan record;
  v_has_recurring_invoice boolean := false;
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

  -- Canonical monthly-plan resolution (invoice service line > order_items > equipment json > subtotal)
  SELECT * INTO v_plan FROM public.fn_resolve_order_monthly_service(v_order) LIMIT 1;

  -- Detect if there is at least one recurring service on the invoice
  SELECT EXISTS (
    SELECT 1
    FROM public.billing_invoice_lines bil
    JOIN public.billing_invoices bi ON bi.id = bil.invoice_id
    WHERE bi.order_id = p_order_id
      AND bil.line_type = 'service'
      AND COALESCE(bil.unit_price, bil.line_total, 0) > 0
  ) INTO v_has_recurring_invoice;

  v_line_items := COALESCE(
    v_order.equipment_details->'line_items',
    v_order.pricing_snapshot->'line_items',
    v_order.equipment_line_details
  );

  v_category := CASE
    WHEN COALESCE(v_plan.service_category, v_order.service_type, '') ILIKE '%internet%' THEN 'Internet'
    WHEN COALESCE(v_plan.service_category, v_order.service_type, '') ILIKE '%tv%'
      OR COALESCE(v_plan.service_category, v_order.service_type, '') ILIKE '%télé%' THEN 'TV'
    WHEN COALESCE(v_plan.service_category, v_order.service_type, '') ILIKE '%combo%' THEN 'TV'
    WHEN COALESCE(v_plan.service_category, v_order.service_type, '') ILIKE '%mobile%'
      OR COALESCE(v_plan.service_category, v_order.service_type, '') ILIKE '%cell%' THEN 'Mobile'
    WHEN COALESCE(v_plan.service_category, v_order.service_type, '') ILIKE '%streaming%' THEN 'Streaming'
    ELSE 'Other'
  END;

  -- No recurring plan on the order => do not create a subscription
  -- (pure equipment/fee/one-time orders must not appear as monthly subs).
  IF COALESCE(v_plan.plan_price, 0) <= 0 AND NOT v_has_recurring_invoice THEN
    RETURN jsonb_build_object(
      'success', true,
      'services_created', 0,
      'service_rows_inserted', 0,
      'subscription_id', NULL,
      'skipped', 'no_recurring_service',
      'category', v_category
    );
  END IF;

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
      customer_id, plan_code, plan_name, plan_price,
      cycle_start_date, cycle_end_date, status, order_id,
      address_id, service_category
    ) VALUES (
      v_customer_id,
      COALESCE(v_plan.plan_code, v_order.category, v_order.service_type, 'service'),
      COALESCE(v_plan.plan_name, v_order.service_type, 'Service'),
      COALESCE(v_plan.plan_price, 0),
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
      plan_code = CASE
        WHEN v_plan.plan_code IS NOT NULL
             AND (COALESCE(plan_code, '') IN ('', 'UNKNOWN', 'service', 'unknown')
                  OR length(plan_code) > 60)
        THEN v_plan.plan_code
        ELSE plan_code
      END,
      plan_name = CASE
        WHEN v_plan.plan_name IS NOT NULL
             AND (plan_name IS NULL OR plan_name = '' OR lower(plan_name) IN ('internet','service'))
        THEN v_plan.plan_name
        ELSE plan_name
      END,
      plan_price = CASE
        WHEN COALESCE(plan_price, 0) <= 0 AND COALESCE(v_plan.plan_price, 0) > 0
        THEN v_plan.plan_price
        ELSE plan_price
      END,
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

  -- Only insert recurring service rows in billing_subscription_services.
  -- Equipment, one-time, delivery, deplacement, fees, discounts, taxes are
  -- explicitly excluded.
  IF v_line_items IS NOT NULL AND jsonb_typeof(v_line_items) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_line_items)
    LOOP
      v_item_type := lower(COALESCE(v_item->>'type', 'service'));
      v_item_category := lower(COALESCE(v_item->>'category', v_item_type));
      v_item_period := lower(COALESCE(v_item->>'period', ''));
      v_item_name := lower(COALESCE(v_item->>'name', v_item->>'description', ''));

      IF v_item_type IN ('discount','credit','tax','fee','shipping','delivery','equipment','device','sim','esim','router','modem','tv_box','terminal','one_time','deplacement','installation','activation')
         OR v_item_category IN ('discount','credit','tax','fee','shipping','delivery','equipment','device','sim','esim','router','modem','tv_box','terminal','one_time','deplacement','installation','activation')
         OR v_item_name LIKE '%livraison%'
         OR v_item_name LIKE '%deplacement%'
         OR v_item_name LIKE '%déplacement%'
         OR v_item_name LIKE '%frais%'
         OR v_item_name LIKE '%activation%'
         OR v_item_name LIKE '%paiement id%'
      THEN
        CONTINUE;
      END IF;

      -- Require monthly/recurring period OR explicit service category
      IF v_item_period NOT IN ('monthly','month','recurring')
         AND v_item_category NOT IN ('service','plan','subscription','internet','tv','mobile','streaming')
      THEN
        CONTINUE;
      END IF;

      INSERT INTO public.billing_subscription_services (
        subscription_id, service_code, service_name, service_type,
        unit_price, quantity, is_active, added_at
      ) VALUES (
        v_sub_id,
        COALESCE(v_item->>'code', v_item->>'sku', v_item->>'type', 'plan'),
        COALESCE(v_item->>'name', v_item->>'description', 'Service'),
        'recurring',
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
  END IF;

  -- Fallback: if there is no recurring row yet but we have a resolved plan,
  -- create a single service row from the resolved monthly plan.
  IF NOT EXISTS (
    SELECT 1 FROM public.billing_subscription_services bss
    WHERE bss.subscription_id = v_sub_id AND bss.is_active = true
  ) AND COALESCE(v_plan.plan_price, 0) > 0 THEN
    INSERT INTO public.billing_subscription_services (
      subscription_id, service_code, service_name, service_type,
      unit_price, quantity, is_active, added_at
    ) VALUES (
      v_sub_id,
      COALESCE(v_plan.plan_code, 'plan'),
      COALESCE(v_plan.plan_name, 'Service'),
      'recurring',
      v_plan.plan_price,
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

-- 3) Backfill order 58953 subscription with correct plan info from invoice line
UPDATE public.billing_subscriptions bs
SET plan_code = 'internet_giga_30j',
    plan_name = 'Internet Giga — 30 jours',
    plan_price = 60.00,
    service_category = 'Internet',
    updated_at = now()
WHERE bs.id = '532c133f-1b3f-4e4f-aef8-e6c0f5f61e1b';

-- Remove any subscription_service rows for that sub that reference equipment/fees
DELETE FROM public.billing_subscription_services
WHERE subscription_id = '532c133f-1b3f-4e4f-aef8-e6c0f5f61e1b'
  AND (
    service_type = 'one_time'
    OR lower(COALESCE(service_name,'')) LIKE '%borne wifi%'
    OR lower(COALESCE(service_name,'')) LIKE '%livraison%'
    OR lower(COALESCE(service_name,'')) LIKE '%deplacement%'
    OR lower(COALESCE(service_name,'')) LIKE '%déplacement%'
    OR lower(COALESCE(service_name,'')) LIKE '%frais%'
    OR lower(COALESCE(service_name,'')) LIKE '%paiement id%'
  );

-- Ensure at least one recurring row for the corrected plan
INSERT INTO public.billing_subscription_services (
  subscription_id, service_code, service_name, service_type,
  unit_price, quantity, is_active, added_at
)
SELECT '532c133f-1b3f-4e4f-aef8-e6c0f5f61e1b', 'internet_giga_30j',
       'Internet Giga — 30 jours', 'recurring', 60.00, 1, true, now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.billing_subscription_services
  WHERE subscription_id = '532c133f-1b3f-4e4f-aef8-e6c0f5f61e1b'
    AND is_active = true
);
