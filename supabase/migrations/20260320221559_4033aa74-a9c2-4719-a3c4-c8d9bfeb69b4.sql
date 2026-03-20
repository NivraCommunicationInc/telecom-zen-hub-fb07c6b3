-- Add Stripe subscription sync columns to billing_subscriptions
ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS stripe_status text,
  ADD COLUMN IF NOT EXISTS stripe_current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_cancel_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_default_payment_method text,
  ADD COLUMN IF NOT EXISTS next_renewal_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_cycle_anchor timestamptz;

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_stripe_sub_id 
  ON public.billing_subscriptions(stripe_subscription_id) 
  WHERE stripe_subscription_id IS NOT NULL;

-- Anti-duplication: prevent same order from having multiple Stripe subscriptions
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_subscriptions_order_stripe_unique
  ON public.billing_subscriptions(order_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- Plan mapping table: maps Nivra plan codes to Stripe products/prices
CREATE TABLE IF NOT EXISTS public.stripe_plan_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code text NOT NULL UNIQUE,
  plan_name text NOT NULL,
  stripe_product_id text NOT NULL,
  stripe_price_id text NOT NULL,
  monthly_amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'cad',
  service_category text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stripe_plan_mapping ENABLE ROW LEVEL SECURITY;

-- Admin read-only policy
CREATE POLICY "Authenticated users can read plan mapping"
  ON public.stripe_plan_mapping FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.stripe_plan_mapping IS 'Canonical mapping between Nivra plan codes and Stripe Products/Prices. Source of truth for subscription creation.';
COMMENT ON COLUMN public.billing_subscriptions.stripe_subscription_id IS 'Stripe Subscription ID — synced from Stripe';
COMMENT ON COLUMN public.billing_subscriptions.stripe_price_id IS 'Stripe recurring Price ID';
COMMENT ON COLUMN public.billing_subscriptions.stripe_status IS 'Stripe subscription status (active, past_due, canceled, etc.)';
COMMENT ON COLUMN public.billing_subscriptions.next_renewal_at IS 'Next renewal/charge date';
COMMENT ON COLUMN public.billing_subscriptions.billing_cycle_anchor IS 'Stripe billing_cycle_anchor timestamp';