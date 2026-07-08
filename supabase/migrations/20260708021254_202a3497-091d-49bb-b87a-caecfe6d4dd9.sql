CREATE OR REPLACE FUNCTION public.fn_activate_sub_on_order_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_activation_date TIMESTAMPTZ;
  v_activation_day  INT;
  v_anchor_day      INT;
  v_anchor_candidate DATE;
  v_days_in_month   INT;
  v_cycle_end       DATE;
  v_next_renewal    TIMESTAMPTZ;
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
      billing_cycle_day, billing_anchor_day, billing_anchor_date, next_invoice_date
    ) VALUES (
      NEW.user_id,
      COALESCE(NULLIF(v_profile.full_name, ''), btrim(v_first_name || ' ' || v_last_name), 'Client Nivra'),
      'active',
      NEW.shipping_address, NEW.shipping_city, NEW.shipping_postal_code, 'QC',
      NEW.shipping_address, NEW.shipping_city, NEW.shipping_postal_code, 'QC',
      v_activation_day, v_activation_day, v_activation_date::date, (v_activation_date + INTERVAL '1 month')::date
    )
    RETURNING id, account_number INTO v_account_id, v_account_number;

    NEW.account_id := v_account_id;
  END IF;

  IF v_account_id IS NOT NULL THEN
    SELECT a.billing_cycle_day, a.billing_anchor_day, a.billing_anchor_date, a.next_invoice_date, a.status
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

    IF v_acct.billing_cycle_day IS NULL AND v_acct.billing_anchor_day IS NULL THEN
      BEGIN
        UPDATE public.accounts a
        SET billing_cycle_day = v_activation_day,
            billing_anchor_day = v_activation_day,
            billing_anchor_date = COALESCE(a.billing_anchor_date, v_activation_date::date)
        WHERE a.id = v_account_id;
      EXCEPTION WHEN check_violation THEN
        NULL;
      END;
    END IF;
  END IF;

  v_anchor_day := COALESCE(v_acct.billing_anchor_day, v_acct.billing_cycle_day, v_activation_day);
  v_anchor_day := GREATEST(1, LEAST(31, v_anchor_day));

  v_days_in_month := EXTRACT(DAY FROM (date_trunc('month', v_activation_date)::date + INTERVAL '1 month - 1 day'))::INT;
  v_anchor_candidate := make_date(
    EXTRACT(YEAR FROM v_activation_date)::INT,
    EXTRACT(MONTH FROM v_activation_date)::INT,
    LEAST(v_anchor_day, v_days_in_month)
  );

  IF v_anchor_candidate <= v_activation_date::date THEN
    v_days_in_month := EXTRACT(DAY FROM (date_trunc('month', v_activation_date)::date + INTERVAL '2 month - 1 day'))::INT;
    v_anchor_candidate := make_date(
      EXTRACT(YEAR FROM (v_activation_date + INTERVAL '1 month'))::INT,
      EXTRACT(MONTH FROM (v_activation_date + INTERVAL '1 month'))::INT,
      LEAST(v_anchor_day, v_days_in_month)
    );
  END IF;

  -- Canonical: cycle_end_date is always the day before the account anchor day.
  v_cycle_end := (v_anchor_candidate - INTERVAL '1 day')::DATE;
  v_next_renewal := v_anchor_candidate::TIMESTAMPTZ;

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
      cycle_end_date = v_cycle_end,
      next_renewal_at = v_next_renewal,
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
      v_cycle_end,
      v_activation_date,
      v_next_renewal,
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