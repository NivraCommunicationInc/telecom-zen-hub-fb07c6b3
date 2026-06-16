-- FEATURE 2: Anti-fraud score 0-100 for main orders table

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fraud_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fraud_level TEXT NOT NULL DEFAULT 'none'
    CHECK (fraud_level IN ('none','low','medium','high','blocked')),
  ADD COLUMN IF NOT EXISTS fraud_flags JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fraud_blocked BOOLEAN NOT NULL DEFAULT false;

-- Scoring function called after order insert/update
CREATE OR REPLACE FUNCTION public.fn_compute_order_fraud_score(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_score INTEGER := 0;
  v_flags JSONB := '{}';
  v_same_email_count INTEGER;
  v_disposable_domains TEXT[] := ARRAY[
    'mailinator.com','guerrillamail.com','trashmail.com','tempmail.com',
    'throwam.com','yopmail.com','sharklasers.com','guerrillamailblock.com',
    'grr.la','guerrillamail.info','spam4.me','10minutemail.com','maildrop.cc'
  ];
  v_email_domain TEXT;
  v_level TEXT;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Flag 1: disposable email (+25)
  v_email_domain := lower(split_part(COALESCE(v_order.client_email, ''), '@', 2));
  IF v_email_domain = ANY(v_disposable_domains) THEN
    v_score := v_score + 25;
    v_flags := v_flags || jsonb_build_object('email_jetable', 25);
  END IF;

  -- Flag 2: multiple orders same email last 7 days (+15 per extra)
  SELECT COUNT(*) INTO v_same_email_count
  FROM public.orders
  WHERE client_email = v_order.client_email
    AND id <> p_order_id
    AND created_at >= now() - INTERVAL '7 days';
  IF v_same_email_count >= 2 THEN
    v_score := v_score + 20;
    v_flags := v_flags || jsonb_build_object('commandes_recentes', 20);
  ELSIF v_same_email_count = 1 THEN
    v_score := v_score + 10;
    v_flags := v_flags || jsonb_build_object('commandes_recentes', 10);
  END IF;

  -- Flag 3: incomplete/missing address (+15)
  IF COALESCE(v_order.service_address, '') = ''
     OR COALESCE(v_order.service_city, '') = ''
     OR COALESCE(v_order.service_postal_code, '') = '' THEN
    v_score := v_score + 15;
    v_flags := v_flags || jsonb_build_object('adresse_incomplete', 15);
  END IF;

  -- Flag 4: no phone (+10)
  IF COALESCE(v_order.client_phone, '') = '' THEN
    v_score := v_score + 10;
    v_flags := v_flags || jsonb_build_object('telephone_manquant', 10);
  END IF;

  -- Flag 5: test/suspicious name (+15)
  IF v_order.client_first_name ILIKE 'test%'
     OR v_order.client_last_name ILIKE 'test%'
     OR v_order.client_first_name ILIKE 'fake%'
     OR v_order.client_first_name ILIKE 'admin%' THEN
    v_score := v_score + 15;
    v_flags := v_flags || jsonb_build_object('nom_suspect', 15);
  END IF;

  -- Cap at 100
  v_score := LEAST(v_score, 100);

  -- Determine level
  v_level := CASE
    WHEN v_score > 80 THEN 'blocked'
    WHEN v_score > 60 THEN 'high'
    WHEN v_score > 35 THEN 'medium'
    WHEN v_score > 10 THEN 'low'
    ELSE 'none'
  END;

  UPDATE public.orders
  SET fraud_score   = v_score,
      fraud_level   = v_level,
      fraud_flags   = v_flags,
      fraud_blocked = (v_score > 80)
  WHERE id = p_order_id;
END;
$$;

-- Trigger to auto-compute on insert
CREATE OR REPLACE FUNCTION public.fn_trigger_order_fraud_score()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.fn_compute_order_fraud_score(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_fraud_score ON public.orders;
CREATE TRIGGER trg_order_fraud_score
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_order_fraud_score();

-- Backfill existing orders (skip if too many rows – just score the last 100)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.orders
    ORDER BY created_at DESC
    LIMIT 100
  LOOP
    PERFORM public.fn_compute_order_fraud_score(r.id);
  END LOOP;
END;
$$;
