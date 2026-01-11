
-- Temporairement désactiver le trigger pour corriger les données legacy
DROP TRIGGER IF EXISTS trg_protect_paid_invoice ON billing;

-- Recalculer toutes les factures non-paid basé sur les paiements réels
UPDATE billing b
SET 
  amount_paid = sub.total_paid,
  balance_due = GREATEST(0, b.amount - sub.total_paid),
  status = CASE 
    WHEN sub.total_paid >= b.amount THEN 'paid'
    WHEN sub.total_paid > 0 THEN 'partial'
    ELSE b.status
  END,
  paid_at = CASE 
    WHEN sub.total_paid >= b.amount AND b.paid_at IS NULL THEN NOW()
    ELSE b.paid_at
  END
FROM (
  SELECT 
    COALESCE(p.billing_id, p.invoice_id) AS invoice_id,
    COALESCE(SUM(p.amount) FILTER (WHERE p.status IN ('completed', 'processed', 'captured')), 0) AS total_paid
  FROM payments p
  WHERE p.billing_id IS NOT NULL OR p.invoice_id IS NOT NULL
  GROUP BY COALESCE(p.billing_id, p.invoice_id)
) sub
WHERE b.id = sub.invoice_id
AND b.status != 'paid';

-- Pour les factures paid avec mauvais amount_paid/balance_due, corriger aussi
UPDATE billing b
SET 
  amount_paid = sub.total_paid,
  balance_due = 0
FROM (
  SELECT 
    COALESCE(p.billing_id, p.invoice_id) AS invoice_id,
    COALESCE(SUM(p.amount) FILTER (WHERE p.status IN ('completed', 'processed', 'captured')), 0) AS total_paid
  FROM payments p
  WHERE p.billing_id IS NOT NULL OR p.invoice_id IS NOT NULL
  GROUP BY COALESCE(p.billing_id, p.invoice_id)
) sub
WHERE b.id = sub.invoice_id
AND b.status = 'paid'
AND (b.amount_paid IS DISTINCT FROM sub.total_paid OR b.balance_due IS DISTINCT FROM 0);

-- Factures sans paiements: s'assurer que amount_paid = 0
UPDATE billing
SET 
  amount_paid = 0,
  balance_due = amount
WHERE id NOT IN (
  SELECT DISTINCT COALESCE(billing_id, invoice_id) 
  FROM payments 
  WHERE billing_id IS NOT NULL OR invoice_id IS NOT NULL
)
AND status != 'paid'
AND (amount_paid IS NULL OR amount_paid != 0 OR balance_due IS DISTINCT FROM amount);

-- Recréer le trigger
CREATE TRIGGER trg_protect_paid_invoice
  BEFORE UPDATE ON billing
  FOR EACH ROW
  EXECUTE FUNCTION protect_paid_invoice();
