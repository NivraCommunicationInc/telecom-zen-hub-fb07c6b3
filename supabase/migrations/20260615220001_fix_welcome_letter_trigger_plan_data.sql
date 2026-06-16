-- Fix trg_doc_welcome_letter: include plan/price from most recent order so PDFs
-- don't show "Service Nivra" / "0,00 $" when billing_subscriptions doesn't exist yet.
-- Fix trg_doc_contract_amendment: add plan_price fallback when unit_price is 0/null.

CREATE OR REPLACE FUNCTION public.trg_doc_welcome_letter()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email      text;
  v_payload    jsonb;
  v_plan_name  text;
  v_plan_price numeric;
BEGIN
  SELECT email INTO v_email FROM public.profiles WHERE user_id = NEW.client_id;

  -- Try most recent completed order first
  SELECT
    COALESCE(o.plan_name, o.service_name),
    COALESCE(o.plan_price, o.monthly_amount, o.total_amount)
  INTO v_plan_name, v_plan_price
  FROM public.orders o
  WHERE o.user_id = NEW.client_id
  ORDER BY o.created_at DESC
  LIMIT 1;

  -- Fallback: active billing_subscription
  IF v_plan_name IS NULL THEN
    SELECT bs.plan_name, bs.plan_price
    INTO v_plan_name, v_plan_price
    FROM public.billing_customers bc
    JOIN public.billing_subscriptions bs ON bs.customer_id = bc.id
    WHERE bc.email = v_email
    ORDER BY bs.created_at DESC
    LIMIT 1;
  END IF;

  v_payload := public._build_doc_client_payload(NEW.client_id, NEW.id)
    || jsonb_build_object(
        'letter_number',  'BVN-' || to_char(NEW.created_at, 'YYYYMMDD') || '-' || SUBSTRING(NEW.id::text, 1, 8),
        'created_at',     NEW.created_at,
        'service_name',   COALESCE(v_plan_name, ''),
        'plan_name',      COALESCE(v_plan_name, ''),
        'monthly_amount', COALESCE(v_plan_price, 0),
        'plan_price',     COALESCE(v_plan_price, 0)
    );

  PERFORM public.enqueue_document_job(
    NEW.id, NEW.client_id, 'welcome_letter', 'account.created',
    'welcome_letter::' || NEW.id::text, v_email, v_payload
  );
  RETURN NEW;
END; $$;


CREATE OR REPLACE FUNCTION public.trg_doc_contract_amendment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client_id  uuid;
  v_email      text;
  v_account_id uuid;
  v_change_type text;
  v_payload    jsonb;
  v_plan_price numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN v_change_type := 'service_added';
  ELSIF TG_OP = 'UPDATE' AND OLD.is_active = TRUE AND NEW.is_active = FALSE THEN v_change_type := 'service_removed';
  ELSE RETURN NEW; END IF;

  SELECT bc.user_id, bc.email INTO v_client_id, v_email
  FROM public.billing_subscriptions bs
  JOIN public.billing_customers bc ON bc.id = bs.customer_id
  WHERE bs.id = NEW.subscription_id;
  IF v_client_id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_account_id FROM public.accounts WHERE client_id = v_client_id LIMIT 1;

  -- Use unit_price; if 0 or null, fall back to subscription's plan_price
  v_plan_price := NEW.unit_price;
  IF v_plan_price IS NULL OR v_plan_price = 0 THEN
    SELECT plan_price INTO v_plan_price
    FROM public.billing_subscriptions
    WHERE id = NEW.subscription_id;
  END IF;

  v_payload := public._build_doc_client_payload(v_client_id, v_account_id)
    || jsonb_build_object(
        'amendment_number', 'AMD-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || SUBSTRING(NEW.id::text, 1, 4),
        'change_type',      v_change_type,
        'service_name',     NEW.service_name,
        'service_code',     NEW.service_code,
        'unit_price',       COALESCE(v_plan_price, 0),
        'plan_price',       COALESCE(v_plan_price, 0),
        'quantity',         NEW.quantity,
        'effective_date',   COALESCE(NEW.removed_at, NEW.added_at, now())
    );

  PERFORM public.enqueue_document_job(
    v_account_id, v_client_id, 'contract_amendment', 'subscription.' || v_change_type,
    'contract_amendment::' || NEW.id::text || '::' || v_change_type, v_email, v_payload
  );
  RETURN NEW;
END; $$;
