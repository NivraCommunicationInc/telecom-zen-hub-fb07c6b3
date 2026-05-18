
-- 1. Profile columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_e164 TEXT;

-- 2. sms_queue table
CREATE TABLE IF NOT EXISTS public.sms_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_phone TEXT NOT NULL,
  to_user_id UUID,
  message TEXT NOT NULL,
  event_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','sending','sent','failed','cancelled')),
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_queue_status_created
  ON public.sms_queue(status, created_at)
  WHERE status IN ('queued','sending');

CREATE INDEX IF NOT EXISTS idx_sms_queue_user
  ON public.sms_queue(to_user_id);

ALTER TABLE public.sms_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own sms" ON public.sms_queue;
CREATE POLICY "Users read own sms"
  ON public.sms_queue
  FOR SELECT
  TO authenticated
  USING (auth.uid() = to_user_id);

DROP POLICY IF EXISTS "Staff read all sms" ON public.sms_queue;
CREATE POLICY "Staff read all sms"
  ON public.sms_queue
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'support'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
  );

-- 3. Trigger for orders (confirmed + activated)
CREATE OR REPLACE FUNCTION public.fn_queue_order_sms()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_opt_in BOOLEAN;
  v_full_name TEXT;
  v_first TEXT;
BEGIN
  IF NEW.status IS NULL OR OLD.status IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(p.phone_e164, p.phone), COALESCE(p.sms_opt_in, true), p.full_name, p.first_name
    INTO v_phone, v_opt_in, v_full_name, v_first
    FROM public.profiles p
   WHERE p.user_id = NEW.user_id;

  IF NOT v_opt_in OR v_phone IS NULL OR v_phone = '' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'confirmed' THEN
    INSERT INTO public.sms_queue (to_phone, to_user_id, message, event_key)
    VALUES (
      v_phone,
      NEW.user_id,
      'Nivra: Votre commande #' || COALESCE(NEW.order_number, NEW.id::text)
        || ' est confirmee. Merci '
        || COALESCE(NULLIF(TRIM(v_first), ''), SPLIT_PART(COALESCE(v_full_name,''),' ',1), 'client')
        || '! Suivi: nivra-telecom.ca/suivi-commande',
      'order_confirmed_sms_' || NEW.id::text
    )
    ON CONFLICT (event_key) DO NOTHING;
  END IF;

  IF NEW.status = 'activated' THEN
    INSERT INTO public.sms_queue (to_phone, to_user_id, message, event_key)
    VALUES (
      v_phone,
      NEW.user_id,
      'Nivra: Votre service est active! Profitez de votre connexion.',
      'order_activated_sms_' || NEW.id::text
    )
    ON CONFLICT (event_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_order_sms ON public.orders;
CREATE TRIGGER trg_queue_order_sms
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_queue_order_sms();

-- 4. Trigger for billing_payments (completed)
CREATE OR REPLACE FUNCTION public.fn_queue_payment_sms()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_phone TEXT;
  v_opt_in BOOLEAN;
  v_first TEXT;
BEGIN
  IF NEW.status IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('completed','captured','paid') THEN RETURN NEW; END IF;

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
    'payment_completed_sms_' || NEW.id::text
  )
  ON CONFLICT (event_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_payment_sms ON public.billing_payments;
CREATE TRIGGER trg_queue_payment_sms
  AFTER INSERT OR UPDATE OF status ON public.billing_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_queue_payment_sms();
