-- Add PayPal subscription tracking to billing_subscriptions
ALTER TABLE public.billing_subscriptions 
ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS paypal_plan_id TEXT,
ADD COLUMN IF NOT EXISTS auto_billing_enabled BOOLEAN DEFAULT false;

-- Add index for PayPal subscription lookups
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_paypal_id 
ON public.billing_subscriptions(paypal_subscription_id) 
WHERE paypal_subscription_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.billing_subscriptions.paypal_subscription_id IS 'PayPal Billing Agreement ID for automatic recurring payments';
COMMENT ON COLUMN public.billing_subscriptions.auto_billing_enabled IS 'Whether automatic PayPal billing is enabled for this subscription';