
-- Update update_invoice_balance_on_payment to skip when bypass is active
-- This allows manual adjustments without triggering automatic recalculation
CREATE OR REPLACE FUNCTION update_invoice_balance_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_total_paid numeric;
  v_invoice_amount numeric;
  v_new_balance numeric;
  bypass_mode text;
BEGIN
  -- Check for internal reconcile bypass - skip automatic update
  bypass_mode := current_setting('app.internal_reconcile', true);
  IF bypass_mode = '1' THEN
    RETURN NEW;
  END IF;

  v_invoice_id := COALESCE(NEW.invoice_id, NEW.billing_id);
  
  IF v_invoice_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  IF NEW.status NOT IN ('captured', 'completed', 'paid', 'processed') THEN
    RETURN NEW;
  END IF;
  
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM public.payments
  WHERE (invoice_id = v_invoice_id OR billing_id = v_invoice_id)
    AND status IN ('captured', 'completed', 'paid', 'processed');
  
  SELECT amount INTO v_invoice_amount
  FROM public.billing
  WHERE id = v_invoice_id;
  
  IF v_invoice_amount IS NULL THEN
    RETURN NEW;
  END IF;
  
  v_new_balance := v_invoice_amount - v_total_paid;
  
  -- Enable bypass for the billing update (to pass protect_paid_invoice)
  PERFORM set_config('app.internal_reconcile', '1', true);
  
  UPDATE public.billing
  SET 
    balance_due = v_new_balance,
    amount_paid = v_total_paid,
    status = CASE WHEN v_new_balance <= 0 THEN 'paid' ELSE status END,
    paid_at = CASE WHEN v_new_balance <= 0 AND paid_at IS NULL THEN NOW() ELSE paid_at END
  WHERE id = v_invoice_id;
  
  -- Reset bypass
  PERFORM set_config('app.internal_reconcile', '', true);
  
  RETURN NEW;
END;
$$;
