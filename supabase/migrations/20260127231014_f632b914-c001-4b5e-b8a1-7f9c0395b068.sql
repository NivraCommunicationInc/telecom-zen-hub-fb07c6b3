
-- ============================================================================
-- BILLING SYSTEM AUDIT FIX - Part 1: Fix triggers and data (avoiding protected records)
-- ============================================================================

-- 1. Temporarily disable the protect trigger on legacy billing table
ALTER TABLE billing DISABLE TRIGGER trg_protect_paid_invoice;

-- 2. Fix legacy billing: sync balance_due for paid invoices
UPDATE billing
SET balance_due = 0, amount_paid = amount
WHERE status = 'paid' AND (balance_due > 0 OR balance_due IS NULL OR amount_paid = 0 OR amount_paid IS NULL);

-- 3. Fix legacy billing: calculate missing balance_due for non-paid
UPDATE billing
SET balance_due = GREATEST(0, amount - COALESCE(amount_paid, 0))
WHERE status NOT IN ('paid', 'cancelled', 'voided', 'refunded')
  AND (balance_due IS NULL OR balance_due != GREATEST(0, amount - COALESCE(amount_paid, 0)));

-- 4. Re-enable the protect trigger
ALTER TABLE billing ENABLE TRIGGER trg_protect_paid_invoice;

-- 5. Fix billing_invoices: ensure status=paid has balance_due=0
-- First drop the sync trigger to avoid recursion
ALTER TABLE billing_invoices DISABLE TRIGGER trg_sync_billing_invoice_balance;

UPDATE billing_invoices
SET balance_due = 0
WHERE status = 'paid' AND balance_due > 0;

-- Fix status for invoices where balance is fully paid
UPDATE billing_invoices
SET status = 'paid', paid_at = COALESCE(paid_at, NOW())
WHERE balance_due <= 0 AND amount_paid >= total AND status NOT IN ('paid', 'cancelled', 'refunded');

-- Re-enable
ALTER TABLE billing_invoices ENABLE TRIGGER trg_sync_billing_invoice_balance;

-- 6. Add unique constraint to prevent duplicate payments per invoice (one pending at a time)
DO $$
BEGIN
  -- Create partial unique index for pending payments
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_one_pending_payment_per_invoice'
  ) THEN
    CREATE UNIQUE INDEX idx_one_pending_payment_per_invoice 
    ON billing_payments (invoice_id) 
    WHERE status = 'pending';
  END IF;
END $$;

-- 7. Improve sync_invoice_amount_paid to handle overpayments
CREATE OR REPLACE FUNCTION sync_invoice_amount_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_paid NUMERIC(10,2);
  v_invoice_total NUMERIC(10,2);
  v_new_status billing_invoice_status;
  v_target_invoice_id UUID;
BEGIN
  v_target_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  IF v_target_invoice_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Calculate total confirmed payments
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM billing_payments
  WHERE invoice_id = v_target_invoice_id
    AND status = 'confirmed';
  
  -- Get invoice total
  SELECT total INTO v_invoice_total
  FROM billing_invoices
  WHERE id = v_target_invoice_id;
  
  IF v_invoice_total IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Determine status
  IF v_total_paid >= v_invoice_total THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'pending';
  END IF;
  
  -- Disable sync trigger to avoid recursion
  ALTER TABLE billing_invoices DISABLE TRIGGER trg_sync_billing_invoice_balance;
  
  -- Update invoice
  UPDATE billing_invoices
  SET 
    amount_paid = v_total_paid,
    balance_due = GREATEST(0, total - v_total_paid),
    status = CASE 
      WHEN status IN ('cancelled', 'refunded') THEN status
      ELSE v_new_status 
    END,
    paid_at = CASE 
      WHEN v_new_status = 'paid' AND paid_at IS NULL THEN NOW()
      ELSE paid_at
    END
  WHERE id = v_target_invoice_id;
  
  -- Re-enable
  ALTER TABLE billing_invoices ENABLE TRIGGER trg_sync_billing_invoice_balance;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 8. Log overpayments to system alerts
CREATE OR REPLACE FUNCTION check_overpayment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_paid NUMERIC(10,2);
  v_invoice_total NUMERIC(10,2);
BEGIN
  IF NEW.status = 'confirmed' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM billing_payments
    WHERE invoice_id = NEW.invoice_id AND status = 'confirmed';
    
    SELECT total INTO v_invoice_total
    FROM billing_invoices WHERE id = NEW.invoice_id;
    
    IF v_total_paid > v_invoice_total THEN
      -- Log overpayment alert
      INSERT INTO billing_system_alerts (
        entity_type, entity_id, alert_type, details
      ) VALUES (
        'invoice', NEW.invoice_id, 'overpayment',
        jsonb_build_object(
          'total_paid', v_total_paid,
          'invoice_total', v_invoice_total,
          'overpayment', v_total_paid - v_invoice_total,
          'payment_id', NEW.id
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_overpayment ON billing_payments;
CREATE TRIGGER trg_check_overpayment
AFTER INSERT OR UPDATE OF status ON billing_payments
FOR EACH ROW
EXECUTE FUNCTION check_overpayment();
