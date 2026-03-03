
-- Fix reconcile function to use correct enum values
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
  SELECT total, status INTO v_total, v_old_status
  FROM billing_invoices WHERE id = p_invoice_id;

  IF v_total IS NULL THEN
    RETURN jsonb_build_object('error', 'invoice_not_found');
  END IF;

  -- Only 'confirmed' is the success status in billing_payment_status enum
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
