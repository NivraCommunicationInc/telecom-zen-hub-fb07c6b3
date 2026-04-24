-- ============================================================
-- FIX 1 — field_payment_intents : PayPal link without order
-- ============================================================
CREATE TABLE IF NOT EXISTS public.field_payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.field_quotes(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL,
  paypal_order_id TEXT,
  paypal_approval_url TEXT,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CAD',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | expired | cancelled
  payment_method TEXT NOT NULL DEFAULT 'paypal', -- paypal | card_manual
  customer_email TEXT,
  customer_name TEXT,
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  converted_field_order_id UUID,
  converted_order_id UUID,
  converted_invoice_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fpi_quote ON public.field_payment_intents(quote_id);
CREATE INDEX IF NOT EXISTS idx_fpi_agent ON public.field_payment_intents(agent_id);
CREATE INDEX IF NOT EXISTS idx_fpi_paypal_order ON public.field_payment_intents(paypal_order_id);
CREATE INDEX IF NOT EXISTS idx_fpi_status ON public.field_payment_intents(status);
CREATE INDEX IF NOT EXISTS idx_fpi_expires ON public.field_payment_intents(expires_at) WHERE status = 'pending';

ALTER TABLE public.field_payment_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view their own payment intents"
  ON public.field_payment_intents FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents can insert their own payment intents"
  ON public.field_payment_intents FOR INSERT
  TO authenticated
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update their own pending intents"
  ON public.field_payment_intents FOR UPDATE
  TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_fpi_set_updated_at
  BEFORE UPDATE ON public.field_payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- FIX 2 — card_payment_intents : encrypted manual card capture
-- ============================================================
CREATE TABLE IF NOT EXISTS public.card_payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_reference TEXT NOT NULL,         -- quote_id or temporary ref
  agent_id UUID NOT NULL,
  field_payment_intent_id UUID REFERENCES public.field_payment_intents(id) ON DELETE SET NULL,
  encrypted_card_number TEXT NOT NULL,   -- AES-256-GCM ciphertext (base64)
  encryption_iv TEXT NOT NULL,           -- base64 IV
  encryption_auth_tag TEXT NOT NULL,     -- base64 GCM auth tag
  card_last4 TEXT NOT NULL,
  card_brand TEXT,
  card_expiry TEXT NOT NULL,             -- "MM/YY"
  card_name TEXT NOT NULL,
  cvv_hash TEXT NOT NULL,                -- bcrypt hash, never retrievable
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CAD',
  customer_email TEXT,
  customer_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending_processing',
  processed_at TIMESTAMPTZ,
  processed_by UUID,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cpi_agent ON public.card_payment_intents(agent_id);
CREATE INDEX IF NOT EXISTS idx_cpi_status ON public.card_payment_intents(status);
CREATE INDEX IF NOT EXISTS idx_cpi_expires ON public.card_payment_intents(expires_at);

ALTER TABLE public.card_payment_intents ENABLE ROW LEVEL SECURITY;

-- Only admins can SELECT (encrypted card data is admin-only)
CREATE POLICY "Only admins can read card intents"
  ON public.card_payment_intents FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Agents can insert their own (so payment can be initiated)
CREATE POLICY "Agents can insert their own card intents"
  ON public.card_payment_intents FOR INSERT
  TO authenticated
  WITH CHECK (agent_id = auth.uid());

-- Only admins can update (mark as processed)
CREATE POLICY "Only admins can update card intents"
  ON public.card_payment_intents FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_cpi_set_updated_at
  BEFORE UPDATE ON public.card_payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cleanup function: remove expired/processed card intents
CREATE OR REPLACE FUNCTION public.cleanup_expired_card_intents()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.card_payment_intents
  WHERE expires_at < now()
     OR (status = 'processed' AND processed_at < now() - interval '1 hour');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Cleanup function: mark expired field_payment_intents
CREATE OR REPLACE FUNCTION public.expire_old_field_payment_intents()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.field_payment_intents
  SET status = 'expired', updated_at = now()
  WHERE status = 'pending' AND expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;