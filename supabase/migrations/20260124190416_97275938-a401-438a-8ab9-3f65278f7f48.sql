-- Optimisation: Supprimer index redondant + CHECK anti-vide
DROP INDEX IF EXISTS idx_billing_payments_invoice_reference;

-- Convertir les '' existants en NULL
UPDATE public.billing_payments SET reference = NULL WHERE reference = '';

-- Ajouter CHECK pour forcer NULL au lieu de ''
ALTER TABLE public.billing_payments
ADD CONSTRAINT chk_billing_payments_reference_not_empty
CHECK (reference IS NULL OR reference != '');