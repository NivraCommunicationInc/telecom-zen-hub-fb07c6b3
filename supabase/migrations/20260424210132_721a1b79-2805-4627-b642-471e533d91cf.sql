-- ── 1A. Fix subscription price + plan name from order_items ──
UPDATE billing_subscriptions bs
SET 
  plan_price = oi.unit_price,
  plan_name  = oi.plan_name,
  updated_at = NOW()
FROM order_items oi
WHERE bs.order_id = oi.order_id
  AND bs.plan_price = 0.00
  AND oi.is_recurring = true
  AND oi.unit_price > 0;

-- ── 1B. Fix account billing cycle from active subscription (joined via order) ──
UPDATE accounts a
SET
  billing_cycle_day   = EXTRACT(DAY FROM bs.cycle_start_date)::INT,
  billing_anchor_date = bs.cycle_start_date,
  next_invoice_date   = COALESCE(bs.next_renewal_at::DATE, (bs.cycle_start_date + INTERVAL '1 month')::DATE),
  updated_at          = NOW()
FROM billing_subscriptions bs
JOIN orders o ON o.id = bs.order_id
WHERE o.account_id = a.id
  AND bs.status = 'active'
  AND a.billing_cycle_day IS NULL
  AND bs.cycle_start_date IS NOT NULL;

-- ── 1C. Backfill equipment_inventory from orders.equipment_details JSON ──
INSERT INTO equipment_inventory 
  (account_id, order_id, catalog_name, serial_number, mac_address, imei,
   status, price_client, assigned_at)
SELECT 
  o.account_id,
  o.id,
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
  COALESCE(o.service_activated_at, o.updated_at, NOW())
FROM orders o,
LATERAL jsonb_array_elements(o.equipment_details::jsonb) eq
WHERE o.status IN ('activated','delivered','completed')
  AND o.account_id IS NOT NULL
  AND o.equipment_details IS NOT NULL
  AND jsonb_typeof(o.equipment_details::jsonb) = 'array'
  AND NULLIF(eq->>'serial_number', '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM equipment_inventory ei
    WHERE ei.order_id = o.id
      AND ei.serial_number = eq->>'serial_number'
  );

-- ── FIX 4: Harden activation trigger ──
CREATE OR REPLACE FUNCTION public.fn_activate_sub_on_order_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activation_date TIMESTAMPTZ;
  v_activation_day  INT;
  v_account_id      UUID;
  v_client_id       UUID;
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

  v_activation_date := NEW.service_activated_at;

  IF v_activation_date IS NULL THEN
    RAISE NOTICE
      'Order % reached status % but service_activated_at is NULL — subscription NOT activated.',
      NEW.id, NEW.status;
    RETURN NEW;
  END IF;

  v_activation_day := EXTRACT(DAY FROM v_activation_date)::INT;
  v_client_id := NEW.client_id;

  -- 1) Activate subscription + copy plan price/name from recurring order_items
  UPDATE public.billing_subscriptions bs
  SET
    status                = 'active',
    billing_cycle_anchor  = v_activation_date::DATE,
    cycle_start_date      = v_activation_date::DATE,
    cycle_end_date        = (v_activation_date + INTERVAL '1 month')::DATE,
    next_renewal_at       = (v_activation_date + INTERVAL '1 month'),
    auto_billing_enabled  = TRUE,
    plan_price = CASE
                   WHEN bs.plan_price IS NULL OR bs.plan_price = 0
                   THEN COALESCE(oi.unit_price, bs.plan_price)
                   ELSE bs.plan_price
                 END,
    plan_name  = CASE
                   WHEN bs.plan_name IS NULL OR bs.plan_name = '' OR bs.plan_name = 'internet'
                   THEN COALESCE(oi.plan_name, bs.plan_name)
                   ELSE bs.plan_name
                 END,
    updated_at            = NOW()
  FROM (
    SELECT order_id, unit_price, plan_name
    FROM public.order_items
    WHERE order_id = NEW.id AND is_recurring = true
    ORDER BY unit_price DESC
    LIMIT 1
  ) oi
  WHERE bs.order_id = NEW.id
    AND bs.status IN ('pending', 'incomplete');

  SELECT a.id INTO v_account_id
  FROM public.accounts a
  WHERE a.client_id = v_client_id
  ORDER BY a.created_at DESC
  LIMIT 1;

  -- 2) Anchor account cycle
  IF v_account_id IS NOT NULL THEN
    UPDATE public.accounts
    SET
      billing_cycle_day   = v_activation_day,
      billing_anchor_date = v_activation_date::DATE,
      next_invoice_date   = (v_activation_date + INTERVAL '1 month')::DATE,
      updated_at          = NOW()
    WHERE id = v_account_id;
  END IF;

  -- 3) Create equipment_inventory rows from JSON
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
$$;

DROP TRIGGER IF EXISTS trg_activate_sub_on_order_activation ON public.orders;
CREATE TRIGGER trg_activate_sub_on_order_activation
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.fn_activate_sub_on_order_activation();

-- Enable realtime on tables not already in publication
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='equipment_inventory') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.equipment_inventory;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='accounts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
  END IF;
END $$;