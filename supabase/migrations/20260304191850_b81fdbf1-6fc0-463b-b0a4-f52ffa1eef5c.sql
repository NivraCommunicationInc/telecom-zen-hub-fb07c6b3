CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_payments_provider_payment_id_unique 
ON public.billing_payments (provider_payment_id) 
WHERE provider_payment_id IS NOT NULL;