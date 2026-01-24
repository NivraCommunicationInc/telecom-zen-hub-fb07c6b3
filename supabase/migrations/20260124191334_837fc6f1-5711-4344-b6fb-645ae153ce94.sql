-- Corriger les paiements legacy sans reference (ajouter placeholder)
UPDATE public.billing_payments 
SET reference = 'LEGACY-' || LEFT(id::text, 8)
WHERE status = 'confirmed' 
  AND provider = 'interac' 
  AND reference IS NULL;

-- Maintenant ajouter la contrainte
ALTER TABLE public.billing_payments
ADD CONSTRAINT chk_provider_confirmed_reference
CHECK (
  status != 'confirmed'
  OR
  (status = 'confirmed' AND provider = 'interac' AND reference IS NOT NULL AND provider_payment_id IS NULL)
  OR
  (status = 'confirmed' AND provider = 'paypal' AND provider_payment_id IS NOT NULL AND reference IS NULL)
  OR
  (status = 'confirmed' AND provider NOT IN ('interac', 'paypal') AND (reference IS NOT NULL OR provider_payment_id IS NOT NULL))
);

COMMENT ON CONSTRAINT chk_provider_confirmed_reference ON public.billing_payments IS 
'Paiement confirmé: Interac exige reference, PayPal exige provider_payment_id. Pending = libre.';