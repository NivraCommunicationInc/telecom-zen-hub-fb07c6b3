CREATE OR REPLACE FUNCTION public.fn_activate_sub_on_order_activation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_client_id := NEW.user_id;

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
    AND bs.status = 'pending';

  SELECT a.id INTO v_account_id
  FROM public.accounts a
  WHERE a.client_id = v_client_id
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF v_account_id IS NOT NULL THEN
    UPDATE public.accounts
    SET
      billing_cycle_day   = v_activation_day,
      billing_anchor_date = v_activation_date::DATE,
      next_invoice_date   = (v_activation_date + INTERVAL '1 month')::DATE,
      updated_at          = NOW()
    WHERE id = v_account_id;
  END IF;

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