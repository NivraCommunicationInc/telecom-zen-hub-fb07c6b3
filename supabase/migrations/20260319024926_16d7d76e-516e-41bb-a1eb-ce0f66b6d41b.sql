
CREATE TABLE public.checkout_consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  account_id UUID,
  -- Consent flags
  terms_accepted BOOLEAN NOT NULL DEFAULT false,
  recurring_payment_accepted BOOLEAN DEFAULT false,
  -- Context
  total_amount_displayed NUMERIC(12,2),
  payment_method TEXT,
  services_displayed JSONB,
  legal_versions JSONB DEFAULT '{"terms":"2026-03-19","privacy":"2026-03-19","refund":"2026-03-19","payment":"2026-03-19"}'::jsonb,
  -- Audit
  ip_address TEXT,
  user_agent TEXT,
  consent_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.checkout_consent_records ENABLE ROW LEVEL SECURITY;

-- Users can insert their own consent records
CREATE POLICY "Users can insert own consent" ON public.checkout_consent_records
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can read their own consent records
CREATE POLICY "Users can read own consent" ON public.checkout_consent_records
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all consent records
CREATE POLICY "Admins can read all consent" ON public.checkout_consent_records
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
