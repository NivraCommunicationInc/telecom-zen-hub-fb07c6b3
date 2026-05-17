-- ============================================================
-- Canonical Field/Core activation repair and portal snapshot access
-- ============================================================

GRANT EXECUTE ON FUNCTION public.get_client_history_snapshot(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_resolve_order_monthly_service(_order public.orders)
RETURNS TABLE(plan_code text, plan_name text, plan_price numeric, service_category text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  WITH from_order_items AS (
    SELECT
      COALESCE(NULLIF(oi.plan_code, ''), oi.service_type::text, NULLIF(_order.service_type, ''), 'service')::text AS plan_code,
      COALESCE(NULLIF(oi.plan_name, ''), NULLIF(_order.service_type, ''), 'Service Nivra')::text AS plan_name,
      GREATEST(COALESCE(oi.unit_price, 0), 0)::numeric AS plan_price,
      COALESCE(NULLIF(oi.service_type::text, ''), NULLIF(_order.category, ''), NULLIF(_order.service_type, ''), 'service')::text AS service_category,
      1 AS priority
    FROM public.order_items oi
    WHERE oi.order_id = _order.id
      AND oi.is_recurring = true
      AND COALESCE(oi.unit_price, 0) > 0
    ORDER BY oi.unit_price DESC
    LIMIT 1
  ),
  from_invoice_lines AS (
    SELECT
      COALESCE(NULLIF(_order.category, ''), NULLIF(_order.service_type, ''), 'service')::text AS plan_code,
      COALESCE(NULLIF(bil.description, ''), NULLIF(_order.service_type, ''), 'Service Nivra')::text AS plan_name,
      GREATEST(COALESCE(bil.unit_price, bil.line_total, 0), 0)::numeric AS plan_price,
      COALESCE(NULLIF(_order.category, ''), NULLIF(_order.service_type, ''), 'service')::text AS service_category,
      2 AS priority
    FROM public.billing_invoice_lines bil
    JOIN public.billing_invoices bi ON bi.id = bil.invoice_id
    WHERE bi.order_id = _order.id
      AND bil.line_type = 'service'
      AND COALESCE(bil.unit_price, bil.line_total, 0) > 0
    ORDER BY COALESCE(bil.unit_price, bil.line_total, 0) DESC
    LIMIT 1
  ),
  from_equipment_json AS (
    SELECT
      COALESCE(NULLIF(item->>'type', ''), NULLIF(_order.category, ''), 'service')::text AS plan_code,
      COALESCE(NULLIF(item->>'name', ''), NULLIF(item->>'label', ''), NULLIF(_order.service_type, ''), 'Service Nivra')::text AS plan_name,
      GREATEST(COALESCE(NULLIF(item->>'unit_price', '')::numeric, NULLIF(item->>'price_monthly', '')::numeric, NULLIF(item->>'monthly_price', '')::numeric, 0), 0)::numeric AS plan_price,
      COALESCE(NULLIF(item->>'type', ''), NULLIF(_order.category, ''), 'service')::text AS service_category,
      3 AS priority
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(_order.equipment_details) = 'object' AND jsonb_typeof(_order.equipment_details->'line_items') = 'array'
          THEN _order.equipment_details->'line_items'
        WHEN jsonb_typeof(_order.equipment_details) = 'array'
          THEN _order.equipment_details
        ELSE '[]'::jsonb
      END
    ) item
    WHERE COALESCE(item->>'period', '') = 'monthly'
       OR COALESCE(item->>'category', '') = 'service'
    ORDER BY GREATEST(COALESCE(NULLIF(item->>'unit_price', '')::numeric, NULLIF(item->>'price_monthly', '')::numeric, NULLIF(item->>'monthly_price', '')::numeric, 0), 0) DESC
    LIMIT 1
  ),
  from_order_amount AS (
    SELECT
      COALESCE(NULLIF(_order.category, ''), NULLIF(_order.service_type, ''), 'service')::text AS plan_code,
      COALESCE(NULLIF(_order.service_type, ''), 'Service Nivra')::text AS plan_name,
      GREATEST(COALESCE(_order.subtotal, 0), 0)::numeric AS plan_price,
      COALESCE(NULLIF(_order.category, ''), NULLIF(_order.service_type, ''), 'service')::text AS service_category,
      4 AS priority
    WHERE COALESCE(_order.subtotal, 0) > 0
  )
  SELECT x.plan_code, x.plan_name, x.plan_price, x.service_category
  FROM (
    SELECT * FROM from_order_items
    UNION ALL SELECT * FROM from_invoice_lines
    UNION ALL SELECT * FROM from_equipment_json
    UNION ALL SELECT * FROM from_order_amount
  ) x
  WHERE x.plan_price > 0
  ORDER BY x.priority, x.plan_price DESC
  LIMIT 1;
END;
$function$;

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

  IF v_account_id IS NOT NULL THEN
    UPDATE public.accounts a
    SET
      status = CASE WHEN a.status IN ('cancelled', 'suspended', 'pending') THEN 'active' ELSE a.status END,
      billing_cycle_day = COALESCE(a.billing_cycle_day, v_activation_day),
      billing_anchor_date = COALESCE(a.billing_anchor_date, v_activation_date::date),
      next_invoice_date = COALESCE(a.next_invoice_date, (v_activation_date + INTERVAL '1 month')::date),
      updated_at = NOW()
    WHERE a.id = v_account_id
    RETURNING a.account_number INTO v_account_number;
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
      plan_code = CASE WHEN COALESCE(bs.plan_code, '') IN ('', 'UNKNOWN', 'service') AND v_plan.plan_code IS NOT NULL THEN v_plan.plan_code ELSE bs.plan_code END,
      plan_name = CASE WHEN (bs.plan_name IS NULL OR bs.plan_name = '' OR lower(bs.plan_name) IN ('internet','service')) AND v_plan.plan_name IS NOT NULL THEN v_plan.plan_name ELSE bs.plan_name END,
      plan_price = CASE WHEN COALESCE(bs.plan_price, 0) <= 0 AND COALESCE(v_plan.plan_price, 0) > 0 THEN v_plan.plan_price ELSE bs.plan_price END,
      service_category = COALESCE(bs.service_category, v_plan.service_category, NEW.category, NEW.service_type),
      environment = CASE WHEN bs.environment = 'production' THEN 'live' ELSE bs.environment END,
      source_type = COALESCE(bs.source_type, NEW.source, NEW.created_by),
      updated_at = NOW()
    WHERE bs.id = v_existing_sub_id;
  ELSIF v_customer_id IS NOT NULL AND COALESCE(v_plan.plan_price, 0) > 0 THEN
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

DROP TRIGGER IF EXISTS trg_activate_sub_on_order_activation ON public.orders;
CREATE TRIGGER trg_activate_sub_on_order_activation
  BEFORE INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_activate_sub_on_order_activation();

CREATE OR REPLACE FUNCTION public.fn_repair_activated_order_canonical_chain(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_before_status text;
  v_result jsonb;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable';
  END IF;

  IF auth.uid() IS NOT NULL
     AND auth.uid() <> v_order.user_id
     AND NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee')) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  v_before_status := v_order.status;

  UPDATE public.orders
  SET status = CASE WHEN status IN ('activated','completed','delivered') THEN 'activated' ELSE status END,
      service_activated_at = COALESCE(service_activated_at, NOW()),
      updated_at = NOW()
  WHERE id = _order_id
    AND status IN ('activated','completed','delivered')
  RETURNING * INTO v_order;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La commande n''est pas activée';
  END IF;

  SELECT jsonb_build_object(
    'orderId', v_order.id,
    'status', v_order.status,
    'accountId', v_order.account_id,
    'accountNumber', (SELECT account_number FROM public.accounts WHERE id = v_order.account_id),
    'subscriptions', (SELECT count(*) FROM public.billing_subscriptions WHERE order_id = v_order.id),
    'invoices', (SELECT count(*) FROM public.billing_invoices WHERE order_id = v_order.id),
    'payments', (SELECT count(*) FROM public.billing_payments bp JOIN public.billing_invoices bi ON bi.id = bp.invoice_id WHERE bi.order_id = v_order.id),
    'kyc', (SELECT count(*) FROM public.kyc_verifications WHERE client_id = v_order.user_id)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_repair_activated_order_canonical_chain(uuid) TO authenticated;