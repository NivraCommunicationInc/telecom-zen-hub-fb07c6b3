CREATE OR REPLACE FUNCTION public.fn_canonicalize_order_client_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_email text;
  v_profile record;
  v_account record;
  v_billing_customer_id uuid;
  v_activation_date timestamptz;
  v_activation_day int;
BEGIN
  v_email := lower(nullif(btrim(NEW.client_email), ''));

  IF v_email IS NOT NULL THEN
    SELECT p.* INTO v_profile
    FROM public.profiles p
    WHERE lower(btrim(p.email)) = v_email
    ORDER BY p.created_at ASC
    LIMIT 1;

    IF FOUND AND v_profile.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM v_profile.user_id THEN
      NEW.user_id := v_profile.user_id;
    END IF;

    IF FOUND THEN
      NEW.client_email := COALESCE(NULLIF(NEW.client_email, ''), v_profile.email);
      NEW.client_first_name := COALESCE(NULLIF(NEW.client_first_name, ''), NULLIF(v_profile.first_name, ''), split_part(COALESCE(v_profile.full_name, ''), ' ', 1));
      NEW.client_last_name := COALESCE(NULLIF(NEW.client_last_name, ''), NULLIF(v_profile.last_name, ''), NULLIF(btrim(regexp_replace(COALESCE(v_profile.full_name, ''), '^\S+\s*', '')), ''));
      NEW.client_phone := COALESCE(NULLIF(NEW.client_phone, ''), NULLIF(v_profile.phone, ''));
    END IF;
  END IF;

  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT a.* INTO v_account
  FROM public.accounts a
  WHERE a.client_id = NEW.user_id
  ORDER BY CASE WHEN a.status = 'active' THEN 0 ELSE 1 END, a.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    NEW.account_id := v_account.id;
  ELSIF NEW.account_id IS NOT NULL THEN
    UPDATE public.accounts a
    SET client_id = NEW.user_id,
        updated_at = now()
    WHERE a.id = NEW.account_id
      AND a.client_id IS DISTINCT FROM NEW.user_id;

    SELECT a.* INTO v_account
    FROM public.accounts a
    WHERE a.id = NEW.account_id;
  END IF;

  IF FOUND AND v_account.account_number IS NOT NULL THEN
    UPDATE public.profiles p
    SET account_number = v_account.account_number,
        updated_at = now()
    WHERE p.user_id = NEW.user_id
      AND p.account_number IS DISTINCT FROM v_account.account_number;
  END IF;

  IF v_email IS NOT NULL THEN
    SELECT bc.id INTO v_billing_customer_id
    FROM public.billing_customers bc
    WHERE lower(btrim(bc.email)) = v_email
       OR bc.user_id = NEW.user_id
    ORDER BY CASE WHEN bc.user_id = NEW.user_id THEN 0 ELSE 1 END, bc.created_at DESC NULLS LAST
    LIMIT 1;

    IF v_billing_customer_id IS NOT NULL THEN
      UPDATE public.billing_customers
      SET user_id = NEW.user_id,
          updated_at = now()
      WHERE id = v_billing_customer_id
        AND user_id IS DISTINCT FROM NEW.user_id;
    END IF;
  END IF;

  IF NEW.status IN ('activated', 'completed', 'delivered') THEN
    v_activation_date := COALESCE(NEW.service_activated_at, now());
    v_activation_day := extract(day from v_activation_date)::int;

    IF NEW.account_id IS NOT NULL THEN
      UPDATE public.accounts a
      SET status = CASE WHEN a.status IN ('cancelled', 'suspended', 'pending') THEN 'active' ELSE a.status END,
          billing_cycle_day = COALESCE(a.billing_cycle_day, v_activation_day),
          billing_anchor_date = COALESCE(a.billing_anchor_date, v_activation_date::date),
          next_invoice_date = COALESCE(a.next_invoice_date, (v_activation_date + interval '1 month')::date),
          updated_at = now()
      WHERE a.id = NEW.account_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_canonicalize_order_client_identity ON public.orders;
CREATE TRIGGER trg_canonicalize_order_client_identity
BEFORE INSERT OR UPDATE OF user_id, client_email, account_id, status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.fn_canonicalize_order_client_identity();

CREATE OR REPLACE FUNCTION public.repair_order_client_portal_links()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_identity_fixed int := 0;
  v_accounts_fixed int := 0;
  v_billing_customers_fixed int := 0;
  v_subscriptions_fixed int := 0;
  v_kyc_fixed int := 0;
  v_profile_accounts_fixed int := 0;
  v_profile_account_batch int := 0;
  v_order public.orders%ROWTYPE;
  v_account_id uuid;
  v_account_number text;
  v_customer_id uuid;
  v_plan record;
  v_activation_date timestamptz;
  v_activation_day int;
BEGIN
  WITH matches AS (
    SELECT o.id, p.user_id AS canonical_user_id
    FROM public.orders o
    JOIN public.profiles p ON lower(btrim(p.email)) = lower(btrim(o.client_email))
    WHERE o.client_email IS NOT NULL
      AND o.user_id IS DISTINCT FROM p.user_id
  ), upd AS (
    UPDATE public.orders o
    SET user_id = m.canonical_user_id,
        updated_at = now()
    FROM matches m
    WHERE o.id = m.id
    RETURNING o.id
  )
  SELECT count(*) INTO v_identity_fixed FROM upd;

  FOR v_order IN
    SELECT *
    FROM public.orders
    WHERE status IN ('activated','completed','delivered')
  LOOP
    v_activation_date := COALESCE(v_order.service_activated_at, v_order.updated_at, v_order.created_at, now());
    v_activation_day := extract(day from v_activation_date)::int;
    v_account_id := NULL;
    v_account_number := NULL;
    v_customer_id := NULL;

    SELECT a.id, a.account_number INTO v_account_id, v_account_number
    FROM public.accounts a
    WHERE a.client_id = v_order.user_id
    ORDER BY CASE WHEN a.status = 'active' THEN 0 ELSE 1 END, a.created_at DESC
    LIMIT 1;

    IF v_account_id IS NULL AND v_order.account_id IS NOT NULL THEN
      UPDATE public.accounts a
      SET client_id = v_order.user_id,
          status = CASE WHEN a.status IN ('cancelled','suspended','pending') THEN 'active' ELSE a.status END,
          billing_cycle_day = COALESCE(a.billing_cycle_day, v_activation_day),
          billing_anchor_date = COALESCE(a.billing_anchor_date, v_activation_date::date),
          next_invoice_date = COALESCE(a.next_invoice_date, (v_activation_date + interval '1 month')::date),
          updated_at = now()
      WHERE a.id = v_order.account_id
      RETURNING a.id, a.account_number INTO v_account_id, v_account_number;
      v_accounts_fixed := v_accounts_fixed + 1;
    END IF;

    IF v_account_id IS NULL THEN
      INSERT INTO public.accounts (
        client_id, account_name, status,
        billing_address, billing_city, billing_postal_code, billing_province,
        primary_service_address, primary_service_city, primary_service_postal_code, primary_service_province,
        billing_cycle_day, billing_anchor_date, next_invoice_date
      ) VALUES (
        v_order.user_id,
        COALESCE(NULLIF(btrim(COALESCE(v_order.client_first_name,'') || ' ' || COALESCE(v_order.client_last_name,'')), ''), v_order.client_email, 'Client Nivra'),
        'active',
        v_order.shipping_address, v_order.shipping_city, v_order.shipping_postal_code, COALESCE(v_order.shipping_province, 'QC'),
        v_order.shipping_address, v_order.shipping_city, v_order.shipping_postal_code, COALESCE(v_order.shipping_province, 'QC'),
        v_activation_day, v_activation_date::date, (v_activation_date + interval '1 month')::date
      )
      RETURNING id, account_number INTO v_account_id, v_account_number;
      v_accounts_fixed := v_accounts_fixed + 1;
    ELSE
      UPDATE public.accounts a
      SET status = CASE WHEN a.status IN ('cancelled','suspended','pending') THEN 'active' ELSE a.status END,
          billing_cycle_day = COALESCE(a.billing_cycle_day, v_activation_day),
          billing_anchor_date = COALESCE(a.billing_anchor_date, v_activation_date::date),
          next_invoice_date = COALESCE(a.next_invoice_date, (v_activation_date + interval '1 month')::date),
          updated_at = now()
      WHERE a.id = v_account_id
      RETURNING a.account_number INTO v_account_number;
    END IF;

    IF v_order.account_id IS DISTINCT FROM v_account_id THEN
      UPDATE public.orders SET account_id = v_account_id, updated_at = now() WHERE id = v_order.id;
      v_accounts_fixed := v_accounts_fixed + 1;
    END IF;

    IF v_account_number IS NOT NULL THEN
      UPDATE public.profiles p
      SET account_number = v_account_number,
          updated_at = now()
      WHERE p.user_id = v_order.user_id
        AND p.account_number IS DISTINCT FROM v_account_number;
      GET DIAGNOSTICS v_profile_account_batch = ROW_COUNT;
      v_profile_accounts_fixed := v_profile_accounts_fixed + v_profile_account_batch;
    END IF;

    SELECT bc.id INTO v_customer_id
    FROM public.billing_customers bc
    WHERE bc.user_id = v_order.user_id
       OR (v_order.client_email IS NOT NULL AND lower(btrim(bc.email)) = lower(btrim(v_order.client_email)))
    ORDER BY CASE WHEN bc.user_id = v_order.user_id THEN 0 ELSE 1 END, bc.created_at DESC NULLS LAST
    LIMIT 1;

    IF v_customer_id IS NULL AND v_order.client_email IS NOT NULL THEN
      INSERT INTO public.billing_customers (user_id, first_name, last_name, email, phone, status)
      VALUES (
        v_order.user_id,
        COALESCE(NULLIF(v_order.client_first_name,''), 'Client'),
        COALESCE(NULLIF(v_order.client_last_name,''), 'Nivra'),
        lower(btrim(v_order.client_email)),
        COALESCE(v_order.client_phone, ''),
        'active'
      ) RETURNING id INTO v_customer_id;
      v_billing_customers_fixed := v_billing_customers_fixed + 1;
    ELSIF v_customer_id IS NOT NULL THEN
      UPDATE public.billing_customers
      SET user_id = v_order.user_id,
          status = COALESCE(status, 'active'),
          updated_at = now()
      WHERE id = v_customer_id
        AND (user_id IS DISTINCT FROM v_order.user_id OR status IS NULL);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.kyc_verifications k WHERE k.client_id = v_order.user_id) THEN
      INSERT INTO public.kyc_verifications (client_id, account_id, requested_id_type, reason, status, requested_by)
      VALUES (v_order.user_id, v_account_id, 'government_id', 'Vérification d''identité requise — commande ' || COALESCE(v_order.order_number::text, ''), 'pending', COALESCE(v_order.created_by_agent_id, v_order.user_id));
      v_kyc_fixed := v_kyc_fixed + 1;
    ELSE
      UPDATE public.kyc_verifications
      SET account_id = COALESCE(account_id, v_account_id),
          updated_at = now()
      WHERE client_id = v_order.user_id
        AND account_id IS NULL;
    END IF;

    IF v_customer_id IS NOT NULL THEN
      SELECT * INTO v_plan FROM public.fn_resolve_order_monthly_service(v_order) LIMIT 1;

      IF COALESCE(v_plan.plan_price, 0) > 0 THEN
        IF EXISTS (SELECT 1 FROM public.billing_subscriptions bs WHERE bs.order_id = v_order.id) THEN
          UPDATE public.billing_subscriptions bs
          SET customer_id = v_customer_id,
              status = CASE WHEN bs.status::text = 'cancelled' THEN bs.status ELSE 'active'::public.billing_subscription_status END,
              billing_cycle_anchor = COALESCE(bs.billing_cycle_anchor, v_activation_date),
              cycle_start_date = COALESCE(bs.cycle_start_date, v_activation_date::date),
              cycle_end_date = COALESCE(bs.cycle_end_date, (v_activation_date + interval '1 month')::date),
              next_renewal_at = COALESCE(bs.next_renewal_at, (v_activation_date + interval '1 month')),
              auto_billing_enabled = true,
              plan_code = CASE WHEN COALESCE(bs.plan_code, '') IN ('', 'UNKNOWN', 'service') AND v_plan.plan_code IS NOT NULL THEN v_plan.plan_code ELSE bs.plan_code END,
              plan_name = CASE WHEN (bs.plan_name IS NULL OR bs.plan_name = '' OR lower(bs.plan_name) IN ('internet','service')) AND v_plan.plan_name IS NOT NULL THEN v_plan.plan_name ELSE bs.plan_name END,
              plan_price = CASE WHEN COALESCE(bs.plan_price, 0) <= 0 THEN v_plan.plan_price ELSE bs.plan_price END,
              service_category = COALESCE(bs.service_category, v_plan.service_category, v_order.category, v_order.service_type),
              environment = CASE WHEN bs.environment = 'production' THEN 'live' ELSE bs.environment END,
              source_type = COALESCE(bs.source_type, v_order.source, v_order.created_by),
              updated_at = now()
          WHERE bs.order_id = v_order.id;
        ELSE
          INSERT INTO public.billing_subscriptions (
            customer_id, order_id, plan_code, plan_name, plan_price,
            status, cycle_start_date, cycle_end_date, billing_cycle_anchor,
            next_renewal_at, auto_billing_enabled, service_category, environment, source_type
          ) VALUES (
            v_customer_id,
            v_order.id,
            COALESCE(v_plan.plan_code, v_order.category, v_order.service_type, 'service'),
            COALESCE(v_plan.plan_name, v_order.service_type, 'Service Nivra'),
            v_plan.plan_price,
            'active',
            v_activation_date::date,
            (v_activation_date + interval '1 month')::date,
            v_activation_date,
            (v_activation_date + interval '1 month'),
            true,
            COALESCE(v_plan.service_category, v_order.category, v_order.service_type),
            'live',
            COALESCE(v_order.source, v_order.created_by, 'repair')
          );
          v_subscriptions_fixed := v_subscriptions_fixed + 1;
        END IF;
      END IF;
    END IF;
  END LOOP;

  UPDATE public.billing_customers bc
  SET user_id = p.user_id,
      updated_at = now()
  FROM public.profiles p
  WHERE lower(btrim(bc.email)) = lower(btrim(p.email))
    AND bc.user_id IS DISTINCT FROM p.user_id;
  GET DIAGNOSTICS v_billing_customers_fixed = ROW_COUNT;

  RETURN jsonb_build_object(
    'identity_fixed', v_identity_fixed,
    'accounts_fixed', v_accounts_fixed,
    'billing_customers_fixed', v_billing_customers_fixed,
    'subscriptions_created', v_subscriptions_fixed,
    'kyc_created', v_kyc_fixed,
    'profile_account_numbers_updated', v_profile_accounts_fixed
  );
END;
$$;