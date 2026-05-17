
-- ============================================================
-- 1. Enhance activate-sub trigger: insert if missing, update always
-- ============================================================
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
  v_client_id       UUID;
  v_customer_id     UUID;
  v_existing_sub_id UUID;
  v_recurring       RECORD;
  v_plan_name       TEXT;
  v_plan_price      NUMERIC;
  v_service_cat     TEXT;
BEGIN
  IF NEW.status NOT IN ('delivered', 'activated', 'completed') THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.service_activated_at IS NULL AND NEW.status = 'activated' THEN
    NEW.service_activated_at := NOW();
    NEW.service_activation_source :=
      COALESCE(NEW.service_activation_source, 'trigger_auto_activated');
  END IF;

  v_activation_date := COALESCE(NEW.service_activated_at, NOW());
  v_activation_day  := EXTRACT(DAY FROM v_activation_date)::INT;
  v_client_id := NEW.user_id;

  -- Resolve a recurring item from this order (if any)
  SELECT order_id, unit_price, plan_name, category
  INTO v_recurring
  FROM public.order_items
  WHERE order_id = NEW.id AND is_recurring = true
  ORDER BY unit_price DESC
  LIMIT 1;

  -- Check if a subscription already exists
  SELECT id INTO v_existing_sub_id
  FROM public.billing_subscriptions
  WHERE order_id = NEW.id
  LIMIT 1;

  -- Resolve billing_customers row (needed if we have to insert a new sub)
  IF v_existing_sub_id IS NULL THEN
    SELECT bc.id INTO v_customer_id
    FROM public.billing_customers bc
    WHERE bc.user_id = v_client_id
    ORDER BY bc.created_at DESC
    LIMIT 1;
  END IF;

  IF v_existing_sub_id IS NOT NULL THEN
    -- Always update subscription regardless of previous status,
    -- so reactivated / already-active subs still get a valid cycle.
    UPDATE public.billing_subscriptions bs
    SET
      status                = CASE WHEN bs.status = 'cancelled' THEN bs.status ELSE 'active' END,
      billing_cycle_anchor  = COALESCE(bs.billing_cycle_anchor, v_activation_date),
      cycle_start_date      = COALESCE(bs.cycle_start_date, v_activation_date::DATE),
      cycle_end_date        = COALESCE(bs.cycle_end_date, (v_activation_date + INTERVAL '1 month')::DATE),
      next_renewal_at       = COALESCE(bs.next_renewal_at, (v_activation_date + INTERVAL '1 month')),
      auto_billing_enabled  = TRUE,
      plan_price = CASE
                     WHEN (bs.plan_price IS NULL OR bs.plan_price = 0) AND v_recurring.unit_price IS NOT NULL
                     THEN v_recurring.unit_price
                     ELSE bs.plan_price
                   END,
      plan_name  = CASE
                     WHEN (bs.plan_name IS NULL OR bs.plan_name = '' OR bs.plan_name = 'internet')
                          AND v_recurring.plan_name IS NOT NULL
                     THEN v_recurring.plan_name
                     ELSE bs.plan_name
                   END,
      updated_at            = NOW()
    WHERE bs.id = v_existing_sub_id;
  ELSIF v_recurring.order_id IS NOT NULL AND v_customer_id IS NOT NULL THEN
    -- INSERT a brand-new subscription on the fly (covers field-sales gap)
    v_plan_name  := COALESCE(v_recurring.plan_name, NEW.service_type, 'Service');
    v_plan_price := COALESCE(v_recurring.unit_price, 0);
    v_service_cat := v_recurring.category;
    INSERT INTO public.billing_subscriptions (
      id, customer_id, order_id, plan_code, plan_name, plan_price,
      status, cycle_start_date, cycle_end_date, billing_cycle_anchor,
      next_renewal_at, auto_billing_enabled, service_category, environment
    ) VALUES (
      gen_random_uuid(), v_customer_id, NEW.id,
      COALESCE(v_service_cat, NEW.service_type, 'UNKNOWN'),
      v_plan_name, v_plan_price,
      'active',
      v_activation_date::DATE,
      (v_activation_date + INTERVAL '1 month')::DATE,
      v_activation_date,
      (v_activation_date + INTERVAL '1 month'),
      TRUE,
      v_service_cat,
      'production'
    );
  END IF;

  -- Sync account cycle fields
  SELECT a.id INTO v_account_id
  FROM public.accounts a
  WHERE a.client_id = v_client_id
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF v_account_id IS NOT NULL THEN
    UPDATE public.accounts
    SET
      billing_cycle_day   = COALESCE(billing_cycle_day, v_activation_day),
      billing_anchor_date = COALESCE(billing_anchor_date, v_activation_date::DATE),
      next_invoice_date   = COALESCE(next_invoice_date, (v_activation_date + INTERVAL '1 month')::DATE),
      updated_at          = NOW()
    WHERE id = v_account_id;
  END IF;

  -- Equipment seeding (unchanged from previous version)
  IF NEW.equipment_details IS NOT NULL
     AND jsonb_typeof(NEW.equipment_details::jsonb) = 'array'
     AND v_account_id IS NOT NULL THEN
    INSERT INTO public.equipment_inventory
      (account_id, order_id, catalog_name, serial_number, mac_address, imei,
       status, price_client, assigned_at)
    SELECT
      v_account_id,
      NEW.id,
      COALESCE(eq->>'label', eq->>'type', 'Équipement'),
      NULLIF(eq->>'serial_number', ''),
      NULLIF(eq->>'mac_address', ''),
      NULLIF(eq->>'imei', ''),
      'assigned',
      CASE
        WHEN eq->>'type' = 'router' THEN 60.00
        WHEN eq->>'type' = 'tv_box' THEN 50.00
        WHEN eq->>'type' = 'sim'    THEN 30.00
        ELSE 0
      END,
      v_activation_date
    FROM jsonb_array_elements(NEW.equipment_details::jsonb) eq
    WHERE NULLIF(eq->>'serial_number', '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.equipment_inventory ei
        WHERE ei.order_id = NEW.id
          AND ei.serial_number = eq->>'serial_number'
      );
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- 2. Auto-create pending KYC verification on new order
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_auto_create_kyc_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_account_id  UUID;
  v_requester   UUID;
  v_existing    UUID;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Idempotency: one pending KYC per client
  SELECT id INTO v_existing
  FROM public.kyc_verifications
  WHERE client_id = NEW.user_id
    AND status IN ('pending','requested','in_review')
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_account_id := NEW.account_id;
  v_requester  := COALESCE(NEW.created_by_agent_id, NEW.user_id);

  INSERT INTO public.kyc_verifications (
    client_id, account_id, requested_id_type, reason,
    status, requested_by
  ) VALUES (
    NEW.user_id,
    v_account_id,
    'government_id',
    CASE
      WHEN COALESCE(NEW.source,'') = 'field_sales'
        THEN 'Vérification d''identité requise — commande terrain ' || COALESCE(NEW.order_number::text,'')
      ELSE 'Vérification d''identité requise — commande ' || COALESCE(NEW.order_number::text,'')
    END,
    'pending',
    v_requester
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_create_kyc_on_order ON public.orders;
CREATE TRIGGER trg_auto_create_kyc_on_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_create_kyc_on_order();

-- ============================================================
-- 3. BACKFILL existing data
-- ============================================================

-- 3a. Backfill subscription cycle/renewal/auto-billing for activated orders
UPDATE public.billing_subscriptions bs
SET
  billing_cycle_anchor = COALESCE(bs.billing_cycle_anchor, o.service_activated_at, o.updated_at, NOW()),
  cycle_start_date     = COALESCE(bs.cycle_start_date, (COALESCE(o.service_activated_at, NOW()))::DATE),
  cycle_end_date       = COALESCE(bs.cycle_end_date, (COALESCE(o.service_activated_at, NOW()) + INTERVAL '1 month')::DATE),
  next_renewal_at      = COALESCE(bs.next_renewal_at, COALESCE(o.service_activated_at, NOW()) + INTERVAL '1 month'),
  auto_billing_enabled = TRUE,
  updated_at           = NOW()
FROM public.orders o
WHERE bs.order_id = o.id
  AND o.status IN ('activated','completed','delivered')
  AND bs.status = 'active'
  AND (
    bs.billing_cycle_anchor IS NULL
    OR bs.next_renewal_at IS NULL
    OR bs.auto_billing_enabled IS DISTINCT FROM TRUE
  );

-- 3b. Sync accounts cycle metadata for activated orders
UPDATE public.accounts a
SET
  billing_cycle_day   = COALESCE(a.billing_cycle_day, EXTRACT(DAY FROM COALESCE(o.service_activated_at, NOW()))::INT),
  billing_anchor_date = COALESCE(a.billing_anchor_date, (COALESCE(o.service_activated_at, NOW()))::DATE),
  next_invoice_date   = COALESCE(a.next_invoice_date, (COALESCE(o.service_activated_at, NOW()) + INTERVAL '1 month')::DATE),
  updated_at          = NOW()
FROM public.orders o
WHERE a.id = o.account_id
  AND o.status IN ('activated','completed','delivered')
  AND (a.billing_cycle_day IS NULL OR a.next_invoice_date IS NULL);

-- 3c. Sync profiles.account_number to accounts.account_number where they diverge
UPDATE public.profiles p
SET account_number = a.account_number,
    updated_at = NOW()
FROM public.accounts a
WHERE a.client_id = p.user_id
  AND a.account_number IS NOT NULL
  AND (p.account_number IS DISTINCT FROM a.account_number);

-- 3d. Create missing pending KYC verifications for existing field-sales clients
INSERT INTO public.kyc_verifications (
  client_id, account_id, requested_id_type, reason, status, requested_by
)
SELECT DISTINCT ON (o.user_id)
  o.user_id,
  o.account_id,
  'government_id',
  'Vérification d''identité requise — commande ' || COALESCE(o.order_number::text,''),
  'pending',
  COALESCE(o.created_by_agent_id, o.user_id)
FROM public.orders o
WHERE o.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.kyc_verifications k WHERE k.client_id = o.user_id
  )
ORDER BY o.user_id, o.created_at DESC;
