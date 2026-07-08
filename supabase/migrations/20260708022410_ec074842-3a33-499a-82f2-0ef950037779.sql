CREATE OR REPLACE FUNCTION public.fn_canonicalize_order_client_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_email text;
  v_profile record;
  v_account record;
  v_billing_customer_id uuid;
  v_activation_date timestamptz;
  v_activation_day int;
  v_has_active_subscription boolean := false;
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
      SELECT EXISTS (
        SELECT 1
        FROM public.billing_subscriptions bs
        JOIN public.billing_customers bc ON bc.id = bs.customer_id
        WHERE bc.user_id = NEW.user_id
          AND bs.status::text IN ('active','pending','suspended')
      ) INTO v_has_active_subscription;

      IF v_has_active_subscription THEN
        -- Anchor fields are immutable once a billable subscription exists.
        -- Activation must not fail just because an older account has a missing
        -- billing_anchor_date; cycle_day/anchor_day remain the source of truth.
        UPDATE public.accounts a
        SET status = CASE WHEN a.status IN ('cancelled', 'suspended', 'pending') THEN 'active' ELSE a.status END,
            updated_at = now()
        WHERE a.id = NEW.account_id;
      ELSE
        UPDATE public.accounts a
        SET status = CASE WHEN a.status IN ('cancelled', 'suspended', 'pending') THEN 'active' ELSE a.status END,
            billing_cycle_day = COALESCE(a.billing_cycle_day, v_activation_day),
            billing_anchor_date = COALESCE(a.billing_anchor_date, v_activation_date::date),
            next_invoice_date = COALESCE(a.next_invoice_date, (v_activation_date + interval '1 month')::date),
            updated_at = now()
        WHERE a.id = NEW.account_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;