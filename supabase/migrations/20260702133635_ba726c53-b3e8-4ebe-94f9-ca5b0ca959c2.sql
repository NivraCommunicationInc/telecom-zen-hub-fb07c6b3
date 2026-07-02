
CREATE SEQUENCE IF NOT EXISTS public.nivra_reference_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_nivra_reference()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE yr text; n int;
BEGIN
  yr := to_char(now() AT TIME ZONE 'America/Toronto', 'YYYY');
  n := nextval('public.nivra_reference_seq');
  RETURN 'NVR-' || yr || '-' || lpad(n::text, 5, '0');
END; $$;

ALTER TABLE public.billing_payments
  ADD COLUMN IF NOT EXISTS nivra_reference text UNIQUE;

CREATE OR REPLACE FUNCTION public.set_billing_payment_nivra_ref()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.nivra_reference IS NULL THEN
    NEW.nivra_reference := public.generate_nivra_reference();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_billing_payments_nivra ON public.billing_payments;
CREATE TRIGGER trg_billing_payments_nivra
BEFORE INSERT ON public.billing_payments
FOR EACH ROW EXECUTE FUNCTION public.set_billing_payment_nivra_ref();

CREATE TABLE IF NOT EXISTS public.public_payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  nivra_reference text NOT NULL UNIQUE,
  invoice_id uuid REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.billing_customers(id) ON DELETE SET NULL,
  recipient_name text NOT NULL,
  recipient_email text,
  recipient_phone text,
  amount_due numeric(10,2) NOT NULL CHECK (amount_due > 0),
  description text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','partially_paid','expired','cancelled')),
  created_by uuid,
  created_by_name text,
  sent_at timestamptz,
  reminder_sent_at timestamptz,
  paid_at timestamptz,
  payment_id uuid REFERENCES public.billing_payments(id) ON DELETE SET NULL,
  amount_paid numeric(10,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_payment_links_token ON public.public_payment_links(token);
CREATE INDEX IF NOT EXISTS idx_public_payment_links_status ON public.public_payment_links(status);
CREATE INDEX IF NOT EXISTS idx_public_payment_links_created_at ON public.public_payment_links(created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.public_payment_links TO authenticated;
GRANT ALL ON public.public_payment_links TO service_role;

ALTER TABLE public.public_payment_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage public payment links" ON public.public_payment_links;
CREATE POLICY "Staff manage public payment links"
ON public.public_payment_links FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'billing_admin') OR public.has_role(auth.uid(), 'support') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'sales'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'billing_admin') OR public.has_role(auth.uid(), 'support') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'sales'));

CREATE OR REPLACE FUNCTION public.touch_public_payment_link()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_public_payment_links_touch ON public.public_payment_links;
CREATE TRIGGER trg_public_payment_links_touch
BEFORE UPDATE ON public.public_payment_links
FOR EACH ROW EXECUTE FUNCTION public.touch_public_payment_link();

CREATE TABLE IF NOT EXISTS public.public_payment_attempts (
  id bigserial PRIMARY KEY,
  ip text NOT NULL,
  identifier text,
  success boolean NOT NULL DEFAULT false,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ppa_ip_time ON public.public_payment_attempts(ip, created_at DESC);

GRANT SELECT, INSERT ON public.public_payment_attempts TO authenticated;
GRANT ALL ON public.public_payment_attempts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.public_payment_attempts_id_seq TO authenticated, service_role;

ALTER TABLE public.public_payment_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff read attempts" ON public.public_payment_attempts;
CREATE POLICY "Staff read attempts" ON public.public_payment_attempts
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

UPDATE public.billing_payments
SET nivra_reference = public.generate_nivra_reference()
WHERE nivra_reference IS NULL;
