
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
  SELECT total, status::text INTO v_total, v_old_status
  FROM billing_invoices WHERE id = p_invoice_id;

  IF v_total IS NULL THEN
    RETURN jsonb_build_object('error', 'invoice_not_found');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM billing_payments
  WHERE invoice_id = p_invoice_id
    AND status = 'confirmed';

  IF v_old_status IN ('void', 'cancelled', 'refunded') THEN
    v_new_status := v_old_status;
  ELSIF v_paid >= v_total AND v_total > 0 THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := v_old_status;
    IF v_old_status = 'paid' AND v_paid < v_total THEN
      v_new_status := 'pending';
    END IF;
  END IF;

  UPDATE billing_invoices
  SET amount_paid = v_paid,
      status = v_new_status::billing_invoice_status,
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

-- Also fix the invariant trigger to cast properly
CREATE OR REPLACE FUNCTION public.enforce_invoice_invariants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.amount_paid := COALESCE(NEW.amount_paid, 0);
  NEW.balance_due := GREATEST(NEW.total - NEW.amount_paid, 0);

  IF NEW.status = 'paid' THEN
    IF NEW.amount_paid < NEW.total THEN
      NEW.status := 'pending'::billing_invoice_status;
      NEW.paid_at := NULL;
      
      INSERT INTO billing_system_alerts (entity_type, entity_id, alert_type, details)
      VALUES ('invoice', NEW.id, 'invariant_violation',
        jsonb_build_object(
          'rule', 'paid_without_sufficient_payment',
          'invoice_number', NEW.invoice_number,
          'total', NEW.total,
          'amount_paid', NEW.amount_paid
        )
      );
    ELSE
      IF NEW.paid_at IS NULL THEN
        NEW.paid_at := NOW();
      END IF;
      NEW.balance_due := 0;
    END IF;
  END IF;

  IF NEW.balance_due > 0 AND NEW.status = 'paid' THEN
    NEW.status := 'pending'::billing_invoice_status;
    NEW.paid_at := NULL;
  END IF;

  IF NEW.status = 'overdue' THEN
    NEW.status := 'pending'::billing_invoice_status;
    INSERT INTO billing_system_alerts (entity_type, entity_id, alert_type, details)
    VALUES ('invoice', NEW.id, 'invariant_violation',
      jsonb_build_object('rule', 'overdue_blocked_prepaid', 'invoice_number', NEW.invoice_number)
    );
  END IF;

  RETURN NEW;
END;
$$;
