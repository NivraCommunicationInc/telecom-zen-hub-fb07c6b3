-- =====================================================
-- FIX: protect_paid_invoice - Secure bypass detection
-- Remove exploitable checks (current_user='postgres', request.jwt.claims)
-- Use only session_user and pg_has_role for server context detection
-- =====================================================

CREATE OR REPLACE FUNCTION public.protect_paid_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bypass TEXT;
  v_is_server_context BOOLEAN;
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
  
  -- Bypass ONLY allowed for true server context
  -- Use session_user (immutable during session) and pg_has_role
  -- DO NOT use current_user (changes with SECURITY DEFINER)
  -- DO NOT use request.jwt.claims (spoofable)
  v_is_server_context := (
    session_user = 'postgres' OR
    session_user = 'supabase_admin' OR
    pg_has_role(session_user, 'service_role', 'member')
  );
  
  -- Only allow bypass for verified server context
  IF v_bypass = '1' THEN
    IF v_is_server_context THEN
      RETURN NEW; -- Allow bypass
    ELSE
      -- Security event: bypass attempted without server context
      RAISE WARNING '[SECURITY] Bypass attempted by non-server context. session_user=%, current_user=%', 
        session_user, current_user;
      -- Fall through to immutability checks (do not allow bypass)
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

COMMENT ON FUNCTION public.protect_paid_invoice() IS 
'[P0 HARDENING v3] Protects paid invoices from financial field modifications.
Bypass via app.internal_reconcile=1 requires VERIFIED server context:
- session_user IN (postgres, supabase_admin) OR
- pg_has_role(session_user, service_role, member)
REMOVED: current_user check (exploitable in SECURITY DEFINER)
REMOVED: request.jwt.claims check (spoofable)
Protected columns: amount, subtotal, fees, credits, taxes, delivery/activation/installation fees, 
discount_amount, late_fee_amount, preauth_discount, amount_paid, balance_due.';