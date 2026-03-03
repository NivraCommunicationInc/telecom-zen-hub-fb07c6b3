
-- Legacy billing trigger for payments table
CREATE OR REPLACE FUNCTION public.sync_legacy_billing_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_paid NUMERIC;
  v_invoice_total NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM payments
  WHERE billing_id = NEW.billing_id
    AND status = 'completed';

  SELECT amount INTO v_invoice_total
  FROM billing
  WHERE id = NEW.billing_id;

  IF v_invoice_total IS NULL THEN
    RETURN NEW;
  END IF;

  v_new_balance := GREATEST(0, v_invoice_total - v_total_paid);

  UPDATE billing
  SET
    amount_paid = v_total_paid,
    balance_due = v_new_balance,
    status = CASE WHEN v_new_balance <= 0 THEN 'paid' ELSE status END,
    paid_at = CASE WHEN v_new_balance <= 0 THEN COALESCE(paid_at, NOW()) ELSE paid_at END
  WHERE id = NEW.billing_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_legacy_billing_on_payment ON payments;

CREATE TRIGGER trg_sync_legacy_billing_on_payment
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION sync_legacy_billing_on_payment();
