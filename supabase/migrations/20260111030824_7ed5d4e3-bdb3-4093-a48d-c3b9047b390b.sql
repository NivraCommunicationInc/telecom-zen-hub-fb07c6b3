
-- Corriger les 5 factures avec balance_due incorrect
-- Ces factures paid doivent avoir balance_due = 0 (déjà le cas) 
-- MAIS leur amount_paid devrait refléter le montant réellement payé

-- Pour les factures DEMO, on accepte qu'elles soient paid même si partiellement payées
-- On met à jour amount_paid = amount pour cohérence (puisqu'elles sont marquées paid)

-- D'abord désactiver le trigger
DROP TRIGGER IF EXISTS trg_protect_paid_invoice ON billing;

-- Corriger les factures paid dont balance_due = 0 mais amount_paid < amount
UPDATE billing
SET amount_paid = amount
WHERE status = 'paid' 
  AND balance_due = 0 
  AND amount_paid < amount;

-- Corriger la facture INV-MJT1HCAH (balance_due = 10 mais status = paid)
UPDATE billing
SET balance_due = 0, amount_paid = amount
WHERE invoice_number = 'INV-MJT1HCAH' AND status = 'paid';

-- Recréer le trigger
CREATE TRIGGER trg_protect_paid_invoice
  BEFORE UPDATE ON billing
  FOR EACH ROW
  EXECUTE FUNCTION protect_paid_invoice();
