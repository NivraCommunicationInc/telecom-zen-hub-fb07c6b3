-- ============================================
-- NIVRA LEDGER - BATCH ALLOCATION COUNTS + CREDITBLOCKED FIX
-- ============================================

-- 1. Create batch function for allocation counts (avoid N+1)
CREATE OR REPLACE FUNCTION public.get_entries_allocation_counts(p_entry_ids UUID[])
RETURNS TABLE (
  entry_id UUID,
  allocation_count INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    e.id as entry_id,
    COALESCE(
      (SELECT COUNT(*)::INTEGER 
       FROM ledger_invoice_allocations lia 
       WHERE lia.payment_entry_id = e.id OR lia.invoice_entry_id = e.id),
      0
    ) as allocation_count
  FROM unnest(p_entry_ids) AS e(id);
$$;

-- 2. Update get_client_ledger_balance to fix creditBlocked logic
-- creditBlocked = outstanding_invoices > 0 (simple, no balance check needed)
DROP FUNCTION IF EXISTS public.get_client_ledger_balance(UUID);

CREATE FUNCTION public.get_client_ledger_balance(p_client_id UUID)
RETURNS TABLE (
  total_debits NUMERIC,
  total_credits NUMERIC,
  balance NUMERIC,
  amount_due NUMERIC,
  available_credit NUMERIC,
  outstanding_invoices BIGINT,
  oldest_unpaid_date TIMESTAMPTZ,
  credit_blocked BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_debits NUMERIC := 0;
  v_total_credits NUMERIC := 0;
  v_balance NUMERIC := 0;
  v_amount_due NUMERIC := 0;
  v_available_credit NUMERIC := 0;
  v_outstanding_invoices BIGINT := 0;
  v_oldest_unpaid_date TIMESTAMPTZ := NULL;
  v_credit_blocked BOOLEAN := FALSE;
BEGIN
  -- Calculate total debits (invoices, charges) - positive amounts
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_debits
  FROM ledger_entries
  WHERE client_id = p_client_id AND amount > 0;

  -- Calculate total credits (captured payments only) - absolute of negative amounts
  SELECT COALESCE(SUM(ABS(amount)), 0)
  INTO v_total_credits
  FROM ledger_entries
  WHERE client_id = p_client_id 
    AND amount < 0
    AND (captured_at IS NOT NULL OR payment_status IN ('paid', 'complete', 'captured', 'confirmed'));

  -- Calculate raw balance (positive = owes money, negative = has credit) - for admin debug only
  v_balance := v_total_debits - v_total_credits;

  -- Count outstanding invoices (invoices with remaining balance > 0)
  SELECT COUNT(*), MIN(created_at)
  INTO v_outstanding_invoices, v_oldest_unpaid_date
  FROM ledger_entries le
  WHERE le.client_id = p_client_id
    AND le.amount > 0
    AND le.entry_type IN ('invoice', 'charge', 'fee', 'order')
    AND (le.amount - COALESCE(le.amount_allocated, 0)) > 0.01;

  -- Amount due: sum of unallocated invoice amounts (always >= 0)
  SELECT COALESCE(SUM(le.amount - COALESCE(le.amount_allocated, 0)), 0)
  INTO v_amount_due
  FROM ledger_entries le
  WHERE le.client_id = p_client_id
    AND le.amount > 0
    AND le.entry_type IN ('invoice', 'charge', 'fee', 'order')
    AND (le.amount - COALESCE(le.amount_allocated, 0)) > 0.01;

  -- Ensure amount_due is never negative
  v_amount_due := GREATEST(v_amount_due, 0);

  -- STRICT RULE: creditBlocked = outstanding_invoices > 0 (simple, no balance check)
  v_credit_blocked := v_outstanding_invoices > 0;

  -- Available credit: only when NO outstanding invoices AND balance is negative
  IF NOT v_credit_blocked AND v_balance < 0 THEN
    v_available_credit := ABS(v_balance);
  ELSE
    v_available_credit := 0;
  END IF;

  RETURN QUERY SELECT 
    v_total_debits,
    v_total_credits,
    v_balance,
    v_amount_due,
    v_available_credit,
    v_outstanding_invoices,
    v_oldest_unpaid_date,
    v_credit_blocked;
END;
$$;

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION public.get_client_ledger_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_entries_allocation_counts(UUID[]) TO authenticated;