-- ============================================================
-- V2 MULTI-PROVIDER: Support futur Stripe + Interac
-- ============================================================

-- 1) Colonnes provider + provider_payment_id
ALTER TABLE public.billing_payments
ADD COLUMN IF NOT EXISTS provider text DEFAULT 'interac',
ADD COLUMN IF NOT EXISTS provider_payment_id text;

-- 2) Normalisation: vides -> NULL
UPDATE public.billing_payments
SET provider_payment_id = NULL
WHERE provider_payment_id = '';

-- 3) CHECK anti-vide
ALTER TABLE public.billing_payments
ADD CONSTRAINT chk_billing_payments_provider_not_empty
CHECK (provider IS NOT NULL AND btrim(provider) <> '');

ALTER TABLE public.billing_payments
ADD CONSTRAINT chk_billing_payments_provider_payment_id_not_empty
CHECK (provider_payment_id IS NULL OR btrim(provider_payment_id) <> '');

-- 4) UNIQUE composite (idempotence multi-provider)
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_payments_provider_payment_unique
ON public.billing_payments (provider, provider_payment_id)
WHERE provider_payment_id IS NOT NULL;

-- Note: 'method' = type de paiement (interac/manual)
--       'provider' = processeur (interac/stripe/paypal)
--       'reference' = clé Interac legacy (unique globale)
--       'provider_payment_id' = ID du provider (pi_xxx pour Stripe)