-- =====================================================
-- FIX: Synchronize profile balance with billing status
-- When a billing record changes status to 'paid', update profile balance
-- =====================================================

-- 1. Create function to recalculate client balance from all unpaid invoices
CREATE OR REPLACE FUNCTION public.recalculate_client_balance(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_due NUMERIC := 0;
BEGIN
  -- Sum all unpaid/pending invoices for this client
  SELECT COALESCE(SUM(
    GREATEST(0, COALESCE(amount, 0) - COALESCE(amount_paid, 0) - COALESCE(credits, 0))
  ), 0)
  INTO v_total_due
  FROM public.billing
  WHERE user_id = p_user_id
    AND status NOT IN ('paid', 'cancelled', 'refunded', 'void');
  
  RETURN v_total_due;
END;
$$;

-- 2. Create trigger function to sync profile balance when billing changes
CREATE OR REPLACE FUNCTION public.sync_profile_balance_on_billing_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance NUMERIC;
  v_user_id UUID;
BEGIN
  -- Determine which user_id to update
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  
  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Recalculate total balance from all unpaid invoices
  v_new_balance := public.recalculate_client_balance(v_user_id);
  
  -- Update the profile balance
  UPDATE public.profiles
  SET balance = v_new_balance
  WHERE user_id = v_user_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3. Create trigger on billing table
DROP TRIGGER IF EXISTS trg_sync_profile_balance ON public.billing;
CREATE TRIGGER trg_sync_profile_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.billing
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_balance_on_billing_change();

-- 4. Fix existing data - recalculate all client balances
DO $$
DECLARE
  v_user RECORD;
  v_new_balance NUMERIC;
BEGIN
  FOR v_user IN 
    SELECT DISTINCT user_id 
    FROM public.profiles 
    WHERE user_id IS NOT NULL
  LOOP
    v_new_balance := public.recalculate_client_balance(v_user.user_id);
    
    UPDATE public.profiles
    SET balance = v_new_balance
    WHERE user_id = v_user.user_id;
  END LOOP;
END;
$$;

-- 5. Create function to mark billing as paid and sync everything
CREATE OR REPLACE FUNCTION public.mark_billing_as_paid(
  p_billing_id UUID,
  p_payment_method TEXT DEFAULT 'manual',
  p_payment_reference TEXT DEFAULT NULL,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_billing RECORD;
  v_amount_due NUMERIC;
BEGIN
  -- Get billing record
  SELECT * INTO v_billing FROM public.billing WHERE id = p_billing_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Billing record not found: %', p_billing_id;
  END IF;
  
  -- Calculate amount due
  v_amount_due := GREATEST(0, COALESCE(v_billing.amount, 0) - COALESCE(v_billing.amount_paid, 0) - COALESCE(v_billing.credits, 0));
  
  -- Enable bypass for protected invoice update
  PERFORM set_config('app.internal_reconcile', '1', true);
  
  -- Update billing record
  UPDATE public.billing
  SET 
    status = 'paid',
    paid_at = COALESCE(paid_at, now()),
    amount_paid = COALESCE(amount_paid, 0) + v_amount_due,
    balance_due = 0,
    payment_method_type = COALESCE(payment_method_type, p_payment_method),
    payment_reference = COALESCE(payment_reference, p_payment_reference),
    notes = CASE 
      WHEN p_admin_note IS NOT NULL THEN COALESCE(notes, '') || E'\n' || p_admin_note
      ELSE notes
    END
  WHERE id = p_billing_id;
  
  -- Reset bypass
  PERFORM set_config('app.internal_reconcile', '', true);
  
  -- The trg_sync_profile_balance trigger will automatically update the profile balance
  
  RETURN TRUE;
END;
$$;