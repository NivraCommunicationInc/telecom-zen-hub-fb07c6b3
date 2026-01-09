-- =============================================
-- NOWPayments Integration Tables
-- =============================================

-- 1) payment_gateway_settings (admin-only config)
CREATE TABLE public.payment_gateway_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'nowpayments',
  mode text NOT NULL DEFAULT 'sandbox' CHECK (mode IN ('sandbox', 'production')),
  enabled_currencies jsonb NOT NULL DEFAULT '["BTC","ETH","XRP","SOL"]'::jsonb,
  min_confirmations int NOT NULL DEFAULT 1,
  payout_wallet_btc text,
  payout_wallet_eth text,
  payout_wallet_xrp text,
  payout_wallet_sol text,
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for payment_gateway_settings (admin only)
ALTER TABLE public.payment_gateway_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to payment_gateway_settings"
  ON public.payment_gateway_settings
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Insert default row
INSERT INTO public.payment_gateway_settings (provider, mode, is_enabled)
VALUES ('nowpayments', 'sandbox', false);

-- 2) crypto_payments (payment records)
CREATE TABLE public.crypto_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  billing_id uuid REFERENCES public.billing(id) ON DELETE SET NULL,
  client_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'nowpayments',
  payment_id text, -- NOWPayments payment_id
  payment_status text NOT NULL DEFAULT 'created' CHECK (payment_status IN ('created', 'waiting', 'confirming', 'confirmed', 'sending', 'partially_paid', 'finished', 'failed', 'refunded', 'expired')),
  price_amount numeric NOT NULL, -- Amount in CAD
  price_currency text NOT NULL DEFAULT 'cad',
  pay_amount numeric, -- Amount in crypto
  pay_currency text NOT NULL, -- btc/eth/xrp/sol
  pay_address text, -- Unique address for payment
  invoice_url text, -- NOWPayments hosted checkout URL
  actually_paid numeric, -- What was actually received
  outcome_amount numeric, -- Final converted amount
  outcome_currency text,
  txid text, -- Blockchain transaction ID
  raw_ipn jsonb, -- Last IPN payload for debugging
  reconciled_at timestamptz,
  reconciled_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for crypto_payments (admin only)
ALTER TABLE public.crypto_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to crypto_payments"
  ON public.crypto_payments
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3) crypto_ipn_logs (raw IPN logs for audit)
CREATE TABLE public.crypto_ipn_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id text,
  crypto_payment_id uuid REFERENCES public.crypto_payments(id) ON DELETE SET NULL,
  event_type text,
  raw_payload jsonb NOT NULL,
  signature_valid boolean NOT NULL DEFAULT false,
  processed boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for crypto_ipn_logs (admin only)
ALTER TABLE public.crypto_ipn_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to crypto_ipn_logs"
  ON public.crypto_ipn_logs
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Indexes for performance
CREATE INDEX idx_crypto_payments_order_id ON public.crypto_payments(order_id);
CREATE INDEX idx_crypto_payments_client_id ON public.crypto_payments(client_id);
CREATE INDEX idx_crypto_payments_payment_id ON public.crypto_payments(payment_id);
CREATE INDEX idx_crypto_payments_status ON public.crypto_payments(payment_status);
CREATE INDEX idx_crypto_ipn_logs_payment_id ON public.crypto_ipn_logs(payment_id);

-- Trigger for updated_at
CREATE TRIGGER update_payment_gateway_settings_updated_at
  BEFORE UPDATE ON public.payment_gateway_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crypto_payments_updated_at
  BEFORE UPDATE ON public.crypto_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();