-- Add missing audit columns to billing_payments for PayPal reconciliation
ALTER TABLE public.billing_payments 
ADD COLUMN IF NOT EXISTS created_by_id UUID,
ADD COLUMN IF NOT EXISTS created_by_name TEXT,
ADD COLUMN IF NOT EXISTS created_by_role TEXT;

-- Add index for faster PayPal lookups
CREATE INDEX IF NOT EXISTS idx_billing_payments_provider_payment_id 
ON public.billing_payments(provider, provider_payment_id) 
WHERE provider_payment_id IS NOT NULL;