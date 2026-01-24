-- ============================================================
-- V2 PROVIDER: Interac + PayPal (pas Stripe)
-- ============================================================

-- 1) Contrainte de cohérence provider ↔ clés
-- Interac utilise reference, PayPal utilise provider_payment_id
ALTER TABLE public.billing_payments
ADD CONSTRAINT chk_provider_reference_consistency
CHECK (
  (provider = 'interac' AND provider_payment_id IS NULL)
  OR
  (provider = 'paypal' AND reference IS NULL)
  OR
  (provider NOT IN ('interac', 'paypal'))
);

-- 2) Commentaires doc
COMMENT ON COLUMN public.billing_payments.provider IS 
'Processeur de paiement: interac (défaut), paypal';

COMMENT ON COLUMN public.billing_payments.provider_payment_id IS 
'ID PayPal (capture_id ou order_id). NULL pour Interac.';

COMMENT ON COLUMN public.billing_payments.reference IS 
'Référence bancaire Interac (CA1234...). NULL pour PayPal.';