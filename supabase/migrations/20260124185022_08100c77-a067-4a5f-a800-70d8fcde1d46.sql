-- ============================================================
-- STANDARDISATION BILLING V2
-- 1. Ajouter statut 'overdue' à l'enum
-- 2. Ajouter amount_paid + balance_due (calculé)
-- 3. Contrainte UNIQUE anti-doublon renewals
-- 4. Trigger pour maintenir balance_due = total + fees - amount_paid
-- ============================================================

-- 1. Ajouter 'overdue' à l'enum billing_invoice_status
ALTER TYPE billing_invoice_status ADD VALUE IF NOT EXISTS 'overdue';

-- 2. Ajouter colonnes amount_paid et balance_due
ALTER TABLE public.billing_invoices 
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS balance_due NUMERIC(10,2);

-- 3. Initialiser balance_due = total + fees - amount_paid
UPDATE public.billing_invoices 
SET balance_due = COALESCE(total, 0) + COALESCE(fees, 0) - COALESCE(amount_paid, 0)
WHERE balance_due IS NULL;

-- 4. Contrainte UNIQUE pour éviter doublons renewals
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_invoices_renewal_unique 
ON public.billing_invoices (subscription_id, type, cycle_start_date)
WHERE subscription_id IS NOT NULL;

-- 5. Trigger pour maintenir balance_due automatiquement
CREATE OR REPLACE FUNCTION public.sync_billing_invoice_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Ne jamais modifier total pour late fees, seulement fees
  NEW.balance_due := COALESCE(NEW.total, 0) + COALESCE(NEW.fees, 0) - COALESCE(NEW.amount_paid, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_billing_invoice_balance ON public.billing_invoices;
CREATE TRIGGER trg_sync_billing_invoice_balance
BEFORE INSERT OR UPDATE ON public.billing_invoices
FOR EACH ROW EXECUTE FUNCTION public.sync_billing_invoice_balance();

-- 6. Contrainte CHECK: balance_due >= 0 ou NULL
ALTER TABLE public.billing_invoices 
ADD CONSTRAINT chk_balance_due_non_negative 
CHECK (balance_due >= 0 OR balance_due IS NULL);