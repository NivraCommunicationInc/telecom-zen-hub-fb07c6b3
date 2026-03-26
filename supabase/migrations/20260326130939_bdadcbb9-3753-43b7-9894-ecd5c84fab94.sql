
-- Fix: Zero out balance_due on all voided invoices (data integrity)
UPDATE billing_invoices SET balance_due = 0.00, amount_paid = 0.00 WHERE status = 'void' AND balance_due > 0;

-- Trigger: Enforce balance_due = 0 whenever invoice is voided
CREATE OR REPLACE FUNCTION enforce_void_invoice_zero_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'void' THEN
    NEW.balance_due := 0.00;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_void_invoice_zero_balance ON billing_invoices;
CREATE TRIGGER trg_enforce_void_invoice_zero_balance
  BEFORE UPDATE OF status ON billing_invoices
  FOR EACH ROW
  WHEN (NEW.status = 'void')
  EXECUTE FUNCTION enforce_void_invoice_zero_balance();
