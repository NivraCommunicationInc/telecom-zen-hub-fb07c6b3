-- ============================================================
-- V2 FINAL: Contraintes source + provider fallback
-- ============================================================

-- 1) CHECK valeurs autorisées pour source
ALTER TABLE public.billing_payments
DROP CONSTRAINT IF EXISTS chk_billing_payments_source_not_empty;

ALTER TABLE public.billing_payments
ADD CONSTRAINT chk_billing_payments_source_valid
CHECK (source IN ('live', 'legacy_migration', 'test', 'manual_correction'));

-- 2) Mettre à jour contrainte pour exiger au moins une clé pour autres providers
ALTER TABLE public.billing_payments
DROP CONSTRAINT IF EXISTS chk_provider_confirmed_reference;

ALTER TABLE public.billing_payments
ADD CONSTRAINT chk_provider_confirmed_reference
CHECK (
  status != 'confirmed'
  OR source != 'live'
  OR (provider = 'interac' AND reference IS NOT NULL AND provider_payment_id IS NULL)
  OR (provider = 'paypal' AND provider_payment_id IS NOT NULL AND reference IS NULL)
  OR (provider NOT IN ('interac', 'paypal') AND (reference IS NOT NULL OR provider_payment_id IS NOT NULL))
);