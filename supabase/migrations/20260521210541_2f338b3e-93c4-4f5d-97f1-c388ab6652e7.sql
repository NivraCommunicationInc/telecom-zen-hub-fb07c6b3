CREATE OR REPLACE FUNCTION public.fn_earn_loyalty_points_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_points INTEGER;
  v_account_id UUID;
  v_client_id UUID;
  v_new_balance INTEGER;
BEGIN
  IF NEW.status = 'confirmed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed') THEN
    SELECT o.account_id, a.client_id INTO v_account_id, v_client_id
    FROM public.billing_invoices bi
    LEFT JOIN public.orders o ON o.id = bi.order_id
    LEFT JOIN public.accounts a ON a.id = o.account_id
    WHERE bi.id = NEW.invoice_id
    LIMIT 1;

    IF v_account_id IS NULL THEN
      RETURN NEW;
    END IF;

    v_points := FLOOR(COALESCE(NEW.amount, 0) * 10)::INTEGER;
    IF v_points <= 0 THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.loyalty_points (account_id, client_id, total_points, available_points, lifetime_points)
    VALUES (v_account_id, v_client_id, v_points, v_points, v_points)
    ON CONFLICT (account_id) DO UPDATE
      SET total_points = public.loyalty_points.total_points + EXCLUDED.total_points,
          available_points = public.loyalty_points.available_points + EXCLUDED.available_points,
          lifetime_points = public.loyalty_points.lifetime_points + EXCLUDED.lifetime_points,
          tier = CASE
            WHEN public.loyalty_points.lifetime_points + EXCLUDED.lifetime_points >= 5000 THEN 'platinum'
            WHEN public.loyalty_points.lifetime_points + EXCLUDED.lifetime_points >= 1500 THEN 'gold'
            WHEN public.loyalty_points.lifetime_points + EXCLUDED.lifetime_points >= 500 THEN 'silver'
            ELSE 'bronze'
          END,
          tier_updated_at = now(),
          updated_at = now()
    RETURNING available_points INTO v_new_balance;

    INSERT INTO public.loyalty_transactions (account_id, type, points, description, reference_id, reference_type, balance_after, expires_at)
    VALUES (
      v_account_id,
      'earned_payment',
      v_points,
      'Points gagnés sur paiement de ' || COALESCE(NEW.amount, 0) || '$',
      NEW.id,
      'billing_payment',
      v_new_balance,
      now() + INTERVAL '2 years'
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_queue_payment_sms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_phone TEXT;
  v_opt_in BOOLEAN;
  v_first TEXT;
BEGIN
  IF NEW.status IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF NEW.status <> 'confirmed' THEN RETURN NEW; END IF;

  SELECT bc.user_id INTO v_user_id
    FROM public.billing_customers bc
   WHERE bc.id = NEW.customer_id;

  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(p.phone_e164, p.phone), COALESCE(p.sms_opt_in, true), p.first_name
    INTO v_phone, v_opt_in, v_first
    FROM public.profiles p
   WHERE p.user_id = v_user_id;

  IF NOT v_opt_in OR v_phone IS NULL OR v_phone = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.sms_queue (to_phone, to_user_id, message, event_key)
  VALUES (
    v_phone,
    v_user_id,
    'Nivra: Paiement de ' || to_char(COALESCE(NEW.amount, 0), 'FM999G999D00') || '$ recu. Merci '
      || COALESCE(NULLIF(TRIM(v_first), ''), 'client') || '!',
    'payment_confirmed_sms_' || NEW.id::text
  )
  ON CONFLICT (event_key) DO NOTHING;

  RETURN NEW;
END;
$function$;