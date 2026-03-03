
-- ============================================================================
-- BILLING INVARIANT SYSTEM - Systemic enforcement
-- ============================================================================

-- 1) TRIGGER: Enforce invoice invariants on every INSERT/UPDATE
-- balance_due always = max(total - amount_paid, 0)
-- status='paid' requires amount_paid >= total AND balance_due = 0 AND paid_at NOT NULL
-- status cannot be 'paid' if balance_due > 0

CREATE OR REPLACE FUNCTION public.enforce_invoice_invariants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Always recalculate balance_due from total and amount_paid
  NEW.amount_paid := COALESCE(NEW.amount_paid, 0);
  NEW.balance_due := GREATEST(NEW.total - NEW.amount_paid, 0);

  -- If someone tries to set status='paid' but payment doesn't cover total
  IF NEW.status = 'paid' THEN
    IF NEW.amount_paid < NEW.total THEN
      -- Revert to pending - cannot be paid without sufficient payment
      NEW.status := 'pending';
      NEW.paid_at := NULL;
      
      INSERT INTO billing_system_alerts (entity_type, entity_id, alert_type, details)
      VALUES ('invoice', NEW.id, 'invariant_violation',
        jsonb_build_object(
          'rule', 'paid_without_sufficient_payment',
          'invoice_number', NEW.invoice_number,
          'total', NEW.total,
          'amount_paid', NEW.amount_paid,
          'attempted_status', 'paid',
          'corrected_to', 'pending'
        )
      );
    ELSE
      -- Ensure paid_at is set
      IF NEW.paid_at IS NULL THEN
        NEW.paid_at := NOW();
      END IF;
      -- Ensure balance is zero when paid
      NEW.balance_due := 0;
    END IF;
  END IF;

  -- If balance_due > 0, status cannot be 'paid'
  IF NEW.balance_due > 0 AND NEW.status = 'paid' THEN
    NEW.status := 'pending';
    NEW.paid_at := NULL;
  END IF;

  -- Prevent 'overdue' status entirely (prepaid model)
  IF NEW.status = 'overdue' THEN
    NEW.status := 'pending';
    INSERT INTO billing_system_alerts (entity_type, entity_id, alert_type, details)
    VALUES ('invoice', NEW.id, 'invariant_violation',
      jsonb_build_object(
        'rule', 'overdue_blocked_prepaid',
        'invoice_number', NEW.invoice_number,
        'corrected_to', 'pending'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Drop if exists to avoid duplicate
DROP TRIGGER IF EXISTS trg_enforce_invoice_invariants ON billing_invoices;

CREATE TRIGGER trg_enforce_invoice_invariants
  BEFORE INSERT OR UPDATE ON billing_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_invoice_invariants();


-- 2) FUNCTION: Reconcile a single invoice from its payments
CREATE OR REPLACE FUNCTION public.reconcile_invoice_from_payments(p_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC;
  v_paid NUMERIC;
  v_old_status TEXT;
  v_new_status TEXT;
  v_result JSONB;
BEGIN
  -- Get invoice total and current status
  SELECT total, status INTO v_total, v_old_status
  FROM billing_invoices WHERE id = p_invoice_id;

  IF v_total IS NULL THEN
    RETURN jsonb_build_object('error', 'invoice_not_found');
  END IF;

  -- Sum confirmed/captured payments
  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM billing_payments
  WHERE invoice_id = p_invoice_id
    AND status IN ('confirmed', 'captured', 'completed', 'processed');

  -- Determine correct status
  IF v_old_status IN ('void', 'cancelled', 'refunded') THEN
    -- Don't touch terminal statuses
    v_new_status := v_old_status;
  ELSIF v_paid >= v_total AND v_total > 0 THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := v_old_status; -- Keep current if not fully paid
    IF v_old_status = 'paid' AND v_paid < v_total THEN
      v_new_status := 'pending'; -- Correct wrongly-paid
    END IF;
  END IF;

  -- Update invoice (trigger will enforce invariants)
  UPDATE billing_invoices
  SET amount_paid = v_paid,
      status = v_new_status,
      paid_at = CASE WHEN v_new_status = 'paid' AND paid_at IS NULL THEN NOW() 
                     WHEN v_new_status != 'paid' THEN NULL
                     ELSE paid_at END
  WHERE id = p_invoice_id;

  v_result := jsonb_build_object(
    'invoice_id', p_invoice_id,
    'old_status', v_old_status,
    'new_status', v_new_status,
    'total', v_total,
    'amount_paid', v_paid,
    'balance_due', GREATEST(v_total - v_paid, 0),
    'changed', v_old_status != v_new_status
  );

  RETURN v_result;
END;
$$;


-- 3) FUNCTION: Reconcile ALL invoices (for scheduled job)
CREATE OR REPLACE FUNCTION public.reconcile_all_invoices()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_result JSONB;
  v_results JSONB := '[]'::jsonb;
  v_fixed INT := 0;
  v_scanned INT := 0;
BEGIN
  FOR v_invoice IN 
    SELECT id FROM billing_invoices 
    WHERE status NOT IN ('void', 'cancelled', 'refunded')
  LOOP
    v_scanned := v_scanned + 1;
    v_result := reconcile_invoice_from_payments(v_invoice.id);
    
    IF (v_result->>'changed')::boolean THEN
      v_fixed := v_fixed + 1;
      v_results := v_results || v_result;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'scanned', v_scanned,
    'fixed', v_fixed,
    'details', v_results,
    'run_at', NOW()
  );
END;
$$;
