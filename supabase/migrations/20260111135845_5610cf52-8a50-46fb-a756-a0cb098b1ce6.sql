-- =====================================================
-- HARDENING: protect_paid_invoice - Bypass only for service_role
-- =====================================================

CREATE OR REPLACE FUNCTION public.protect_paid_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bypass TEXT;
  v_is_service_role BOOLEAN;
  v_protected_columns TEXT[] := ARRAY[
    'amount', 'subtotal', 'fees', 'credits', 
    'tps_amount', 'tvq_amount', 'delivery_fee', 
    'activation_fee', 'installation_fee', 'discount_amount',
    'late_fee_amount', 'preauth_discount', 'amount_paid', 'balance_due'
  ];
BEGIN
  -- Only protect 'paid' status invoices
  IF OLD.status != 'paid' THEN
    RETURN NEW;
  END IF;
  
  -- Allow specific status transitions (refund, credit, void)
  IF NEW.status IN ('refunded', 'credited', 'void') THEN
    RETURN NEW;
  END IF;
  
  -- Check for internal reconcile bypass
  v_bypass := current_setting('app.internal_reconcile', true);
  
  -- Bypass ONLY works for service_role/postgres context
  -- Determine if we're running as service_role
  v_is_service_role := (
    current_setting('role', true) = 'service_role' OR
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' OR
    session_user = 'postgres' OR
    current_user = 'postgres'
  );
  
  -- Only allow bypass for service_role
  IF v_bypass = '1' THEN
    IF v_is_service_role THEN
      RETURN NEW; -- Allow bypass
    ELSE
      -- Log attempt to bypass without service_role (security event)
      RAISE WARNING '[SECURITY] Bypass attempted without service_role context. User: %, Session: %', 
        current_user, session_user;
      -- Fall through to immutability checks
    END IF;
  END IF;
  
  -- Block status changes (except the allowed ones above)
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION '[IMMUTABILITY] Cannot change status on paid invoice %. Use refunded/credited/void.', OLD.id;
  END IF;
  
  -- Check each protected financial column
  IF NEW.amount IS DISTINCT FROM OLD.amount THEN
    RAISE EXCEPTION '[IMMUTABILITY] Cannot modify amount on paid invoice %', OLD.id;
  END IF;
  IF NEW.subtotal IS DISTINCT FROM OLD.subtotal THEN
    RAISE EXCEPTION '[IMMUTABILITY] Cannot modify subtotal on paid invoice %', OLD.id;
  END IF;
  IF NEW.fees IS DISTINCT FROM OLD.fees THEN
    RAISE EXCEPTION '[IMMUTABILITY] Cannot modify fees on paid invoice %', OLD.id;
  END IF;
  IF NEW.credits IS DISTINCT FROM OLD.credits THEN
    RAISE EXCEPTION '[IMMUTABILITY] Cannot modify credits on paid invoice %', OLD.id;
  END IF;
  IF NEW.tps_amount IS DISTINCT FROM OLD.tps_amount THEN
    RAISE EXCEPTION '[IMMUTABILITY] Cannot modify tps_amount on paid invoice %', OLD.id;
  END IF;
  IF NEW.tvq_amount IS DISTINCT FROM OLD.tvq_amount THEN
    RAISE EXCEPTION '[IMMUTABILITY] Cannot modify tvq_amount on paid invoice %', OLD.id;
  END IF;
  IF NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee THEN
    RAISE EXCEPTION '[IMMUTABILITY] Cannot modify delivery_fee on paid invoice %', OLD.id;
  END IF;
  IF NEW.activation_fee IS DISTINCT FROM OLD.activation_fee THEN
    RAISE EXCEPTION '[IMMUTABILITY] Cannot modify activation_fee on paid invoice %', OLD.id;
  END IF;
  IF NEW.installation_fee IS DISTINCT FROM OLD.installation_fee THEN
    RAISE EXCEPTION '[IMMUTABILITY] Cannot modify installation_fee on paid invoice %', OLD.id;
  END IF;
  IF NEW.discount_amount IS DISTINCT FROM OLD.discount_amount THEN
    RAISE EXCEPTION '[IMMUTABILITY] Cannot modify discount_amount on paid invoice %', OLD.id;
  END IF;
  IF NEW.late_fee_amount IS DISTINCT FROM OLD.late_fee_amount THEN
    RAISE EXCEPTION '[IMMUTABILITY] Cannot modify late_fee_amount on paid invoice %', OLD.id;
  END IF;
  IF NEW.preauth_discount IS DISTINCT FROM OLD.preauth_discount THEN
    RAISE EXCEPTION '[IMMUTABILITY] Cannot modify preauth_discount on paid invoice %', OLD.id;
  END IF;
  IF NEW.amount_paid IS DISTINCT FROM OLD.amount_paid THEN
    RAISE EXCEPTION '[IMMUTABILITY] Cannot modify amount_paid on paid invoice %', OLD.id;
  END IF;
  IF NEW.balance_due IS DISTINCT FROM OLD.balance_due THEN
    RAISE EXCEPTION '[IMMUTABILITY] Cannot modify balance_due on paid invoice %', OLD.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add documentation
COMMENT ON FUNCTION public.protect_paid_invoice() IS 
'[P0 HARDENING v2] Protects paid invoices from financial field modifications.
Bypass via app.internal_reconcile=1 is ONLY effective when running as service_role/postgres.
Regular authenticated users CANNOT bypass immutability even with the setting.
Protected columns: amount, subtotal, fees, credits, taxes, delivery_fee, activation_fee, 
  installation_fee, discount_amount, late_fee_amount, preauth_discount, amount_paid, balance_due.';