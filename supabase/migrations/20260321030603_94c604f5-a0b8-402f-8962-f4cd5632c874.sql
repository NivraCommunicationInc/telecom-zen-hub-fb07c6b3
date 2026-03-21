
-- ============================================================================
-- PHASE 2a: Provider-neutral recurring setup status + PayPal plan cache
-- ============================================================================

-- 1. Create provider-neutral enum for recurring setup status
CREATE TYPE public.recurring_setup_status AS ENUM (
  'pending',
  'active', 
  'failed',
  'skipped',
  'no_provider'
);

-- 2. Add recurring_setup_status to billing_subscriptions (provider-neutral)
ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS recurring_setup_status public.recurring_setup_status DEFAULT NULL;

-- 3. Migrate existing stripe_setup_status values to new column
UPDATE public.billing_subscriptions
SET recurring_setup_status = CASE
  WHEN stripe_setup_status = 'active' THEN 'active'::public.recurring_setup_status
  WHEN stripe_setup_status = 'pending' THEN 'pending'::public.recurring_setup_status
  WHEN stripe_setup_status = 'failed' THEN 'failed'::public.recurring_setup_status
  WHEN stripe_setup_status = 'skipped' THEN 'skipped'::public.recurring_setup_status
  WHEN stripe_setup_status = 'no_stripe' THEN 'no_provider'::public.recurring_setup_status
  ELSE NULL
END
WHERE stripe_setup_status IS NOT NULL;

-- 4. Add recurring_provider column (which provider handles this subscription)
ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS recurring_provider TEXT DEFAULT NULL;

-- 5. Backfill recurring_provider from existing data
UPDATE public.billing_subscriptions
SET recurring_provider = CASE
  WHEN paypal_subscription_id IS NOT NULL THEN 'paypal'
  WHEN stripe_subscription_id IS NOT NULL THEN 'stripe'
  ELSE NULL
END
WHERE recurring_provider IS NULL
  AND (paypal_subscription_id IS NOT NULL OR stripe_subscription_id IS NOT NULL);

-- 6. Create PayPal plan cache table for plan reuse
-- Rule: same (amount_cad, cycle_unit, cycle_count, currency, tax_inclusive) = reuse plan
CREATE TABLE public.paypal_plan_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paypal_plan_id TEXT NOT NULL UNIQUE,
  paypal_product_id TEXT NOT NULL,
  amount_cad NUMERIC(10,2) NOT NULL,
  cycle_unit TEXT NOT NULL DEFAULT 'MONTH',
  cycle_count INTEGER NOT NULL DEFAULT 1,
  currency TEXT NOT NULL DEFAULT 'CAD',
  tax_inclusive BOOLEAN NOT NULL DEFAULT false,
  tax_percentage TEXT NOT NULL DEFAULT '14.975',
  plan_label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique composite key for plan reuse lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_paypal_plan_cache_reuse
  ON public.paypal_plan_cache (amount_cad, cycle_unit, cycle_count, currency, tax_inclusive)
  WHERE is_active = true;

-- Enable RLS (service role only for edge functions)
ALTER TABLE public.paypal_plan_cache ENABLE ROW LEVEL SECURITY;

-- Comment for documentation
COMMENT ON TABLE public.paypal_plan_cache IS 'Cache of PayPal billing plans to prevent plan sprawl. Reuse plans with matching amount/cycle/currency/tax.';
COMMENT ON COLUMN public.billing_subscriptions.recurring_setup_status IS 'Provider-neutral recurring subscription setup status. Replaces stripe_setup_status.';
COMMENT ON COLUMN public.billing_subscriptions.recurring_provider IS 'Which payment provider handles recurring billing: paypal, stripe, interac, or null.';
