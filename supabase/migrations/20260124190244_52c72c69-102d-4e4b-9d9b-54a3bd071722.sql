-- ============================================================
-- V2 IDEMPOTENCY: Empêcher double comptage des paiements
-- ============================================================

-- 1. Index unique sur reference (clé bancaire Interac)
-- Permet NULL (paiements en attente sans référence encore)
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_payments_reference_unique
ON public.billing_payments (reference)
WHERE reference IS NOT NULL AND reference != '';

-- 2. Index unique par facture + référence (double protection)
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_payments_invoice_reference
ON public.billing_payments (invoice_id, reference)
WHERE reference IS NOT NULL AND reference != '';

-- 3. Commentaire pour documentation
COMMENT ON COLUMN public.billing_payments.reference IS 
'Référence bancaire Interac (ex: CA1234567890). UNIQUE pour éviter double comptage.';