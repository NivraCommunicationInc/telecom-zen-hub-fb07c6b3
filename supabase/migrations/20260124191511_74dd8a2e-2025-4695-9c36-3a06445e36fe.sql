-- ============================================================
-- V2 SOURCE-AWARE: Contrainte seulement pour paiements live
-- ============================================================

-- 1) Supprimer contrainte actuelle
ALTER TABLE public.billing_payments
DROP CONSTRAINT IF EXISTS chk_provider_confirmed_reference;

-- 2) Ajouter colonne source + legacy_note
ALTER TABLE public.billing_payments
ADD COLUMN IF NOT EXISTS source text DEFAULT 'live',
ADD COLUMN IF NOT EXISTS legacy_note text;

-- 3) Corriger les paiements legacy (remettre reference=NULL, tagger source)
UPDATE public.billing_payments 
SET 
  legacy_note = reference,
  reference = NULL,
  source = 'legacy_migration'
WHERE reference LIKE 'LEGACY-%';

-- 4) Contrainte source-aware: exigences seulement pour live + confirmed
ALTER TABLE public.billing_payments
ADD CONSTRAINT chk_provider_confirmed_reference
CHECK (
  -- Pas confirmed OU pas live → pas de contrainte
  status != 'confirmed'
  OR source != 'live'
  OR
  -- Live + confirmed + Interac: reference requis
  (status = 'confirmed' AND source = 'live' AND provider = 'interac' AND reference IS NOT NULL AND provider_payment_id IS NULL)
  OR
  -- Live + confirmed + PayPal: provider_payment_id requis  
  (status = 'confirmed' AND source = 'live' AND provider = 'paypal' AND provider_payment_id IS NOT NULL AND reference IS NULL)
  OR
  -- Autres providers
  (status = 'confirmed' AND source = 'live' AND provider NOT IN ('interac', 'paypal'))
);

-- 5) CHECK anti-vide sur source
ALTER TABLE public.billing_payments
ADD CONSTRAINT chk_billing_payments_source_not_empty
CHECK (source IS NOT NULL AND btrim(source) != '');

COMMENT ON COLUMN public.billing_payments.source IS 
'Origine: live (défaut), legacy_migration, test, manual_correction';

COMMENT ON COLUMN public.billing_payments.legacy_note IS 
'Note pour paiements migrés (ex: ancienne référence inventée)';