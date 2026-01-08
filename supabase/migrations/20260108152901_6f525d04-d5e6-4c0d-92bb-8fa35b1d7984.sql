-- ============================================
-- NIVRA LEDGER RULES - STRICT COMPLIANCE
-- ============================================

-- 1. Drop existing function to change return type
DROP FUNCTION IF EXISTS public.get_client_ledger_balance(UUID);

-- 2. Add unique constraints for idempotence (UPSERT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ledger_entries_unique_reference'
  ) THEN
    ALTER TABLE public.ledger_entries
    ADD CONSTRAINT ledger_entries_unique_reference 
    UNIQUE (reference_type, reference_id);
  END IF;
END $$;

-- 3. Create get_client_ledger_balance with amount_due and available_credit
CREATE FUNCTION public.get_client_ledger_balance(p_client_id UUID)
RETURNS TABLE (
  total_debits NUMERIC,
  total_credits NUMERIC,
  balance NUMERIC,
  amount_due NUMERIC,
  available_credit NUMERIC,
  outstanding_invoices BIGINT,
  oldest_unpaid_date TIMESTAMPTZ
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

  -- Calculate raw balance (positive = owes money, negative = has credit)
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

  -- Available credit: only when NO outstanding invoices
  IF v_outstanding_invoices = 0 AND v_balance < 0 THEN
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
    v_oldest_unpaid_date;
END;
$$;

-- 4. Update sync_billing_to_ledger to be idempotent and only sync confirmed payments
CREATE OR REPLACE FUNCTION public.sync_billing_to_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_type TEXT;
  v_amount NUMERIC;
  v_description TEXT;
  v_payment_status TEXT;
  v_captured_at TIMESTAMPTZ;
BEGIN
  -- Determine entry type based on billing status
  IF NEW.status IN ('paid', 'complete', 'captured', 'confirmed') THEN
    -- This is a confirmed payment - create credit entry (negative)
    v_entry_type := 'payment';
    v_amount := -ABS(NEW.amount); -- Credits are negative
    v_description := 'Paiement - ' || COALESCE(NEW.invoice_number, NEW.id::TEXT);
    v_payment_status := NEW.status;
    v_captured_at := COALESCE(NEW.captured_at, NEW.paid_at, NOW());
  ELSIF NEW.status IN ('pending', 'verification', 'awaiting_confirmation') THEN
    -- PENDING/VERIFICATION payments do NOT create ledger entries
    RETURN NEW;
  ELSE
    -- Invoice/charge - create debit entry (positive)
    v_entry_type := 'invoice';
    v_amount := ABS(NEW.amount); -- Debits are positive
    v_description := 'Facture - ' || COALESCE(NEW.invoice_number, NEW.id::TEXT);
    v_payment_status := NEW.status;
    v_captured_at := NULL;
  END IF;

  -- Idempotent UPSERT
  INSERT INTO ledger_entries (
    client_id,
    entry_type,
    amount,
    description,
    reference_type,
    reference_id,
    reference_number,
    payment_method,
    payment_status,
    captured_at
  ) VALUES (
    NEW.user_id,
    v_entry_type,
    v_amount,
    v_description,
    'billing',
    NEW.id,
    NEW.invoice_number,
    NEW.payment_method_type,
    v_payment_status,
    v_captured_at
  )
  ON CONFLICT (reference_type, reference_id) 
  DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    payment_status = EXCLUDED.payment_status,
    captured_at = EXCLUDED.captured_at,
    entry_type = EXCLUDED.entry_type;

  RETURN NEW;
END;
$$;

-- 5. Update sync_monthly_invoice_to_ledger to be idempotent
CREATE OR REPLACE FUNCTION public.sync_monthly_invoice_to_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_type TEXT;
  v_amount NUMERIC;
  v_description TEXT;
  v_payment_status TEXT;
  v_captured_at TIMESTAMPTZ;
BEGIN
  -- Only confirmed payments create credit entries
  IF NEW.status IN ('paid', 'complete', 'captured', 'confirmed') THEN
    v_entry_type := 'payment';
    v_amount := -ABS(NEW.total_amount);
    v_description := 'Paiement facture mensuelle - ' || COALESCE(NEW.invoice_number, NEW.id::TEXT);
    v_payment_status := NEW.status;
    v_captured_at := COALESCE(NEW.paid_at, NOW());
  ELSIF NEW.status IN ('pending', 'verification', 'awaiting_confirmation') THEN
    -- PENDING payments do NOT create ledger entries
    RETURN NEW;
  ELSE
    -- Invoice - debit entry
    v_entry_type := 'invoice';
    v_amount := ABS(NEW.total_amount);
    v_description := 'Facture mensuelle - ' || COALESCE(NEW.invoice_number, NEW.id::TEXT);
    v_payment_status := NEW.status;
    v_captured_at := NULL;
  END IF;

  -- Idempotent UPSERT
  INSERT INTO ledger_entries (
    client_id,
    entry_type,
    amount,
    description,
    reference_type,
    reference_id,
    reference_number,
    payment_status,
    captured_at
  ) VALUES (
    NEW.client_id,
    v_entry_type,
    v_amount,
    v_description,
    'monthly_invoice',
    NEW.id,
    NEW.invoice_number,
    v_payment_status,
    v_captured_at
  )
  ON CONFLICT (reference_type, reference_id)
  DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    payment_status = EXCLUDED.payment_status,
    captured_at = EXCLUDED.captured_at,
    entry_type = EXCLUDED.entry_type;

  RETURN NEW;
END;
$$;

-- 6. Update sync_order_to_ledger to be idempotent
CREATE OR REPLACE FUNCTION public.sync_order_to_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_type TEXT;
  v_amount NUMERIC;
  v_description TEXT;
  v_payment_status TEXT;
  v_captured_at TIMESTAMPTZ;
BEGIN
  -- Only orders with user_id should be synced
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determine entry type based on payment status
  IF NEW.payment_status IN ('paid', 'complete', 'captured', 'confirmed') THEN
    v_entry_type := 'payment';
    v_amount := -ABS(NEW.total_amount);
    v_description := 'Paiement commande - ' || COALESCE(NEW.order_number, NEW.id::TEXT);
    v_payment_status := NEW.payment_status;
    v_captured_at := COALESCE(NEW.paid_at, NOW());
  ELSIF NEW.payment_status IN ('pending', 'verification', 'awaiting_confirmation', 'preauthorized') THEN
    -- PENDING/PREAUTHORIZED do NOT create ledger entries
    RETURN NEW;
  ELSE
    -- Order charge - debit entry
    v_entry_type := 'order';
    v_amount := ABS(NEW.total_amount);
    v_description := 'Commande - ' || COALESCE(NEW.order_number, NEW.id::TEXT);
    v_payment_status := NEW.payment_status;
    v_captured_at := NULL;
  END IF;

  -- Idempotent UPSERT
  INSERT INTO ledger_entries (
    client_id,
    entry_type,
    amount,
    description,
    reference_type,
    reference_id,
    reference_number,
    payment_status,
    captured_at
  ) VALUES (
    NEW.user_id,
    v_entry_type,
    v_amount,
    v_description,
    'order',
    NEW.id,
    NEW.order_number,
    v_payment_status,
    v_captured_at
  )
  ON CONFLICT (reference_type, reference_id)
  DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    payment_status = EXCLUDED.payment_status,
    captured_at = EXCLUDED.captured_at,
    entry_type = EXCLUDED.entry_type;

  RETURN NEW;
END;
$$;

-- 7. Add function to check if entry has allocations (for UI icon)
CREATE OR REPLACE FUNCTION public.get_entry_allocation_count(p_entry_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM ledger_invoice_allocations
  WHERE payment_entry_id = p_entry_id OR invoice_entry_id = p_entry_id;
$$;

-- 8. RLS Policies for ledger_entries
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can read own ledger entries" ON public.ledger_entries;
CREATE POLICY "Clients can read own ledger entries"
ON public.ledger_entries
FOR SELECT
USING (client_id = auth.uid());

DROP POLICY IF EXISTS "Admins can read all ledger entries" ON public.ledger_entries;
CREATE POLICY "Admins can read all ledger entries"
ON public.ledger_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
    AND u.raw_user_meta_data->>'role' IN ('admin', 'super_admin')
  )
);

DROP POLICY IF EXISTS "Service role can manage ledger entries" ON public.ledger_entries;
CREATE POLICY "Service role can manage ledger entries"
ON public.ledger_entries
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- 9. RLS Policies for ledger_invoice_allocations
ALTER TABLE public.ledger_invoice_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can read own allocations" ON public.ledger_invoice_allocations;
CREATE POLICY "Clients can read own allocations"
ON public.ledger_invoice_allocations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM ledger_entries le
    WHERE (le.id = payment_entry_id OR le.id = invoice_entry_id)
    AND le.client_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can read all allocations" ON public.ledger_invoice_allocations;
CREATE POLICY "Admins can read all allocations"
ON public.ledger_invoice_allocations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
    AND u.raw_user_meta_data->>'role' IN ('admin', 'super_admin')
  )
);

DROP POLICY IF EXISTS "Service role can manage allocations" ON public.ledger_invoice_allocations;
CREATE POLICY "Service role can manage allocations"
ON public.ledger_invoice_allocations
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- 10. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_client_ledger_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_entry_allocation_count(UUID) TO authenticated;