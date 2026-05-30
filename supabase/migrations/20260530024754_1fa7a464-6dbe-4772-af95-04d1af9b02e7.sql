ALTER TABLE public.billing_payments DROP CONSTRAINT IF EXISTS chk_provider_reference_consistency;

ALTER TABLE public.billing_payments ADD CONSTRAINT chk_provider_reference_consistency CHECK (
  provider_payment_id IS NOT NULL
  OR reference IS NOT NULL
  OR provider = ANY (ARRAY['cash','bank','manual','card'])
);