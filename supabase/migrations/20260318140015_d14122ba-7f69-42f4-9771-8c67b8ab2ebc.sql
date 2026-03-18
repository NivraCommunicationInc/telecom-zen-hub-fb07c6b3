
-- ═══ AUTOPAY + STRIPE AUTHORIZATION SCHEMA ═══

-- 1) Add autopay columns to billing_customers
ALTER TABLE public.billing_customers
  ADD COLUMN IF NOT EXISTS autopay_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS default_payment_method_id text,
  ADD COLUMN IF NOT EXISTS autopay_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS autopay_discount_active boolean NOT NULL DEFAULT false;

-- 2) Add authorization tracking columns to billing_payments
ALTER TABLE public.billing_payments
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS authorized_amount numeric,
  ADD COLUMN IF NOT EXISTS authorization_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS authorized_at timestamptz,
  ADD COLUMN IF NOT EXISTS captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS capture_expired_at timestamptz,
  ADD COLUMN IF NOT EXISTS captured_by text;

-- 3) Add authorization status to orders  
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_authorization_status text DEFAULT 'none';

-- Comment for clarity
COMMENT ON COLUMN public.billing_customers.autopay_enabled IS 'Whether customer has opted into preauthorized monthly payments';
COMMENT ON COLUMN public.billing_customers.stripe_customer_id IS 'Stripe customer ID for recurring charges';
COMMENT ON COLUMN public.billing_customers.default_payment_method_id IS 'Stripe PaymentMethod ID for autopay';
COMMENT ON COLUMN public.billing_customers.autopay_consent_at IS 'Timestamp of autopay consent';
COMMENT ON COLUMN public.billing_payments.authorization_status IS 'none | authorized | captured | cancelled | expired';
COMMENT ON COLUMN public.billing_payments.stripe_payment_intent_id IS 'Stripe PaymentIntent ID for authorization tracking';
