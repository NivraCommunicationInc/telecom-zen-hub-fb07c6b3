
-- Trigger: When a billing_payment is inserted or updated to 'confirmed',
-- automatically recalculate the linked invoice's amount_paid, balance_due, and status.
CREATE OR REPLACE FUNCTION public.sync_invoice_on_payment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_paid NUMERIC;
  v_invoice_total NUMERIC;
  v_new_balance NUMERIC;
  v_new_status TEXT;
BEGIN
  -- Only act on confirmed payments
  IF NEW.status != 'confirmed' THEN
    RETURN NEW;
  END IF;

  -- Calculate total confirmed payments for this invoice
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM billing_payments
  WHERE invoice_id = NEW.invoice_id
    AND status = 'confirmed';

  -- Get invoice total
  SELECT total INTO v_invoice_total
  FROM billing_invoices
  WHERE id = NEW.invoice_id;

  IF v_invoice_total IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate new balance
  v_new_balance := GREATEST(0, v_invoice_total - v_total_paid);

  -- Determine new status
  IF v_new_balance <= 0 THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'pending';
  END IF;

  -- Update the invoice
  UPDATE billing_invoices
  SET
    amount_paid = v_total_paid,
    balance_due = v_new_balance,
    status = v_new_status,
    paid_at = CASE WHEN v_new_balance <= 0 THEN COALESCE(paid_at, NOW()) ELSE NULL END
  WHERE id = NEW.invoice_id;

  RETURN NEW;
END;
$$;

-- Drop if exists to avoid conflict
DROP TRIGGER IF EXISTS trg_sync_invoice_on_payment ON billing_payments;

CREATE TRIGGER trg_sync_invoice_on_payment
  AFTER INSERT OR UPDATE ON billing_payments
  FOR EACH ROW
  EXECUTE FUNCTION sync_invoice_on_payment_change();
