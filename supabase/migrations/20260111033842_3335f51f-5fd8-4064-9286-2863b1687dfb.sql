
-- ============================================================
-- STEP 1: UPDATE ALL PROTECTIVE TRIGGERS WITH BYPASS MODE
-- ============================================================

-- 1. UPDATE protect_paid_invoice to respect bypass mode
CREATE OR REPLACE FUNCTION protect_paid_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bypass_mode text;
BEGIN
  -- Check for internal reconcile bypass
  bypass_mode := current_setting('app.internal_reconcile', true);
  IF bypass_mode = '1' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'paid' THEN
    IF NEW.status IN ('refunded', 'credited') THEN
      RETURN NEW;
    END IF;
    
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'IMMUTABILITY: Statut facture payée non modifiable (% → %)', OLD.status, NEW.status;
    END IF;
    
    IF NEW.amount IS DISTINCT FROM OLD.amount THEN
      RAISE EXCEPTION 'IMMUTABILITY: amount non modifiable sur facture payée';
    END IF;
    IF NEW.subtotal IS DISTINCT FROM OLD.subtotal THEN
      RAISE EXCEPTION 'IMMUTABILITY: subtotal non modifiable sur facture payée';
    END IF;
    IF NEW.fees IS DISTINCT FROM OLD.fees THEN
      RAISE EXCEPTION 'IMMUTABILITY: fees non modifiable sur facture payée';
    END IF;
    IF NEW.credits IS DISTINCT FROM OLD.credits THEN
      RAISE EXCEPTION 'IMMUTABILITY: credits non modifiable sur facture payée';
    END IF;
    IF NEW.tps_amount IS DISTINCT FROM OLD.tps_amount THEN
      RAISE EXCEPTION 'IMMUTABILITY: tps_amount non modifiable sur facture payée';
    END IF;
    IF NEW.tvq_amount IS DISTINCT FROM OLD.tvq_amount THEN
      RAISE EXCEPTION 'IMMUTABILITY: tvq_amount non modifiable sur facture payée';
    END IF;
    IF NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee THEN
      RAISE EXCEPTION 'IMMUTABILITY: delivery_fee non modifiable sur facture payée';
    END IF;
    IF NEW.activation_fee IS DISTINCT FROM OLD.activation_fee THEN
      RAISE EXCEPTION 'IMMUTABILITY: activation_fee non modifiable sur facture payée';
    END IF;
    IF NEW.installation_fee IS DISTINCT FROM OLD.installation_fee THEN
      RAISE EXCEPTION 'IMMUTABILITY: installation_fee non modifiable sur facture payée';
    END IF;
    IF NEW.discount_amount IS DISTINCT FROM OLD.discount_amount THEN
      RAISE EXCEPTION 'IMMUTABILITY: discount_amount non modifiable sur facture payée';
    END IF;
    IF NEW.late_fee_amount IS DISTINCT FROM OLD.late_fee_amount THEN
      RAISE EXCEPTION 'IMMUTABILITY: late_fee_amount non modifiable sur facture payée';
    END IF;
    IF NEW.preauth_discount IS DISTINCT FROM OLD.preauth_discount THEN
      RAISE EXCEPTION 'IMMUTABILITY: preauth_discount non modifiable sur facture payée';
    END IF;
    IF NEW.amount_paid IS DISTINCT FROM OLD.amount_paid THEN
      RAISE EXCEPTION 'IMMUTABILITY: amount_paid non modifiable sur facture payée';
    END IF;
    IF NEW.balance_due IS DISTINCT FROM OLD.balance_due THEN
      RAISE EXCEPTION 'IMMUTABILITY: balance_due non modifiable sur facture payée';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. UPDATE update_invoice_balance_on_payment to use bypass
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
BEGIN
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
  
  -- Enable bypass for this internal operation
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

-- 3. UPDATE prevent_double_payment to respect bypass mode
CREATE OR REPLACE FUNCTION prevent_double_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_status TEXT;
  v_current_balance NUMERIC;
  bypass_mode TEXT;
BEGIN
  -- Check for internal reconcile bypass
  bypass_mode := current_setting('app.internal_reconcile', true);
  IF bypass_mode = '1' THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('captured', 'completed') THEN
    RETURN NEW;
  END IF;
  
  SELECT status, balance_due INTO v_invoice_status, v_current_balance
  FROM billing
  WHERE id = NEW.billing_id;
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  IF v_invoice_status = 'paid' AND COALESCE(v_current_balance, 0) <= 0 THEN
    RAISE EXCEPTION 'Invoice % is already fully paid. Cannot apply additional payment.', NEW.billing_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. UPDATE recompute_invoice_balance (just in case)
CREATE OR REPLACE FUNCTION recompute_invoice_balance(p_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_captured NUMERIC;
  v_invoice_amount NUMERIC;
  v_new_balance NUMERIC;
  v_new_status TEXT;
  v_current_status TEXT;
BEGIN
  SELECT amount, status INTO v_invoice_amount, v_current_status
  FROM billing
  WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_captured
  FROM payments
  WHERE billing_id = p_invoice_id
    AND status IN ('captured', 'completed', 'refunded');

  v_new_balance := GREATEST(0, v_invoice_amount - v_total_captured);

  IF v_new_balance <= 0 THEN
    v_new_status := 'paid';
  ELSIF v_total_captured > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := v_current_status;
  END IF;

  PERFORM set_config('app.internal_reconcile', '1', true);

  UPDATE billing
  SET 
    amount_paid = v_total_captured,
    balance_due = v_new_balance,
    status = v_new_status
  WHERE id = p_invoice_id;

  PERFORM set_config('app.internal_reconcile', '', true);
END;
$$;

-- 5. UPDATE validate_payment_created_by to auto-fill
CREATE OR REPLACE FUNCTION validate_payment_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_name TEXT;
BEGIN
  IF NEW.source IN ('system', 'system_migration', 'cron', 'webhook', 'stripe_webhook', 'crypto_ipn') THEN
    IF NEW.created_by_id IS NULL THEN
      NEW.created_by_id := '00000000-0000-0000-0000-000000000000'::UUID;
    END IF;
    IF NEW.created_by_name IS NULL OR NEW.created_by_name = '' THEN
      NEW.created_by_name := 'System';
    END IF;
    IF NEW.created_by_role IS NULL OR NEW.created_by_role = '' THEN
      NEW.created_by_role := 'system';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IN ('captured', 'completed', 'pending') THEN
    IF NEW.created_by_id IS NULL THEN
      RAISE EXCEPTION 'created_by_id is required for finalized payments from source: %', NEW.source;
    END IF;
    
    IF NEW.created_by_name IS NULL OR NEW.created_by_name = '' THEN
      SELECT COALESCE(full_name, email, 'Unknown') INTO v_profile_name
      FROM profiles
      WHERE id = NEW.created_by_id;
      
      IF v_profile_name IS NOT NULL THEN
        NEW.created_by_name := v_profile_name;
      ELSE
        NEW.created_by_name := 'Admin';
      END IF;
    END IF;
    
    IF NEW.created_by_role IS NULL OR NEW.created_by_role = '' THEN
      NEW.created_by_role := 'admin';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 6. REVOKE permissions from authenticated on sensitive functions
REVOKE ALL ON FUNCTION recompute_invoice_balance(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION recompute_invoice_balance(UUID) FROM anon;
REVOKE ALL ON FUNCTION recompute_invoice_balance(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION recompute_invoice_balance(UUID) TO service_role;

REVOKE ALL ON FUNCTION mark_payment_error_captured(UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION mark_payment_error_captured(UUID, TEXT, UUID) FROM anon;
REVOKE ALL ON FUNCTION mark_payment_error_captured(UUID, TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION mark_payment_error_captured(UUID, TEXT, UUID) TO service_role;

REVOKE ALL ON FUNCTION recover_error_captured_payment(UUID, TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION recover_error_captured_payment(UUID, TEXT, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION recover_error_captured_payment(UUID, TEXT, UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION recover_error_captured_payment(UUID, TEXT, UUID, TEXT) TO service_role;
