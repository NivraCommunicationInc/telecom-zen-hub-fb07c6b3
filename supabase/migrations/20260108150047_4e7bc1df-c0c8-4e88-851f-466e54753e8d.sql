-- ============================================================
-- LEDGER SYSTEM ENHANCEMENT: Auto Payment Allocation
-- ============================================================
-- First drop the existing function to change its return type
DROP FUNCTION IF EXISTS public.get_client_ledger_balance(uuid);

-- Add invoice allocation tracking table
CREATE TABLE IF NOT EXISTS public.ledger_invoice_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_entry_id UUID NOT NULL REFERENCES public.ledger_entries(id) ON DELETE CASCADE,
  invoice_entry_id UUID NOT NULL REFERENCES public.ledger_entries(id) ON DELETE CASCADE,
  amount_allocated NUMERIC NOT NULL CHECK (amount_allocated > 0),
  allocated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by_id UUID,
  created_by_name TEXT,
  created_by_role TEXT,
  notes TEXT,
  UNIQUE(payment_entry_id, invoice_entry_id)
);

-- Enable RLS
ALTER TABLE public.ledger_invoice_allocations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ledger_invoice_allocations
CREATE POLICY "Admin full access to allocations"
  ON public.ledger_invoice_allocations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Clients can view their own allocations"
  ON public.ledger_invoice_allocations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ledger_entries le
      WHERE le.id = ledger_invoice_allocations.payment_entry_id
        AND le.client_id = auth.uid()
    )
  );

-- Add columns to track allocation status on ledger_entries
ALTER TABLE public.ledger_entries 
  ADD COLUMN IF NOT EXISTS amount_allocated NUMERIC DEFAULT 0;

-- Function to allocate a payment to oldest unpaid invoices (FIFO)
CREATE OR REPLACE FUNCTION public.allocate_payment_to_invoices(
  p_payment_entry_id UUID,
  p_actor_id UUID DEFAULT NULL,
  p_actor_name TEXT DEFAULT 'System',
  p_actor_role TEXT DEFAULT 'system'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_payment_record RECORD;
  v_payment_amount NUMERIC;
  v_remaining_payment NUMERIC;
  v_invoice_record RECORD;
  v_allocation_amount NUMERIC;
  v_allocations JSONB := '[]'::JSONB;
  v_total_allocated NUMERIC := 0;
BEGIN
  -- Get the payment entry
  SELECT * INTO v_payment_record
  FROM public.ledger_entries
  WHERE id = p_payment_entry_id
    AND amount < 0
    AND (captured_at IS NOT NULL OR payment_status IN ('paid', 'complete', 'captured'));
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment entry not found or not captured');
  END IF;
  
  v_payment_amount := ABS(v_payment_record.amount);
  v_remaining_payment := v_payment_amount - COALESCE(v_payment_record.amount_allocated, 0);
  
  IF v_remaining_payment <= 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'Payment already fully allocated', 'allocations', v_allocations);
  END IF;
  
  FOR v_invoice_record IN
    SELECT le.*, le.amount - COALESCE(le.amount_allocated, 0) AS remaining_due
    FROM public.ledger_entries le
    WHERE le.client_id = v_payment_record.client_id
      AND le.amount > 0
      AND le.entry_type IN ('invoice', 'late_fee')
      AND (le.amount - COALESCE(le.amount_allocated, 0)) > 0
    ORDER BY le.created_at ASC
  LOOP
    EXIT WHEN v_remaining_payment <= 0;
    
    v_allocation_amount := LEAST(v_remaining_payment, v_invoice_record.remaining_due);
    
    INSERT INTO public.ledger_invoice_allocations (
      payment_entry_id, invoice_entry_id, amount_allocated,
      created_by_id, created_by_name, created_by_role
    ) VALUES (
      p_payment_entry_id, v_invoice_record.id, v_allocation_amount,
      p_actor_id, p_actor_name, p_actor_role
    )
    ON CONFLICT (payment_entry_id, invoice_entry_id) DO UPDATE
    SET amount_allocated = ledger_invoice_allocations.amount_allocated + v_allocation_amount,
        allocated_at = now();
    
    UPDATE public.ledger_entries
    SET amount_allocated = COALESCE(amount_allocated, 0) + v_allocation_amount
    WHERE id = v_invoice_record.id;
    
    v_allocations := v_allocations || jsonb_build_object(
      'invoice_id', v_invoice_record.id,
      'reference_number', v_invoice_record.reference_number,
      'amount_allocated', v_allocation_amount
    );
    
    v_total_allocated := v_total_allocated + v_allocation_amount;
    v_remaining_payment := v_remaining_payment - v_allocation_amount;
  END LOOP;
  
  UPDATE public.ledger_entries
  SET amount_allocated = COALESCE(amount_allocated, 0) + v_total_allocated
  WHERE id = p_payment_entry_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'total_allocated', v_total_allocated,
    'remaining_credit', v_remaining_payment,
    'allocations', v_allocations
  );
END;
$$;

-- Enhanced balance function with outstanding invoice tracking
CREATE OR REPLACE FUNCTION public.get_client_ledger_balance(p_client_id UUID)
RETURNS TABLE(
  total_debits NUMERIC,
  total_credits NUMERIC,
  balance NUMERIC,
  available_credit NUMERIC,
  outstanding_invoices INTEGER,
  oldest_unpaid_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
STABLE
SET search_path = 'public'
AS $$
DECLARE
  v_debits NUMERIC;
  v_credits NUMERIC;
  v_balance NUMERIC;
  v_outstanding_count INTEGER;
  v_oldest_date TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_debits
  FROM public.ledger_entries
  WHERE client_id = p_client_id AND amount > 0;

  SELECT COALESCE(ABS(SUM(amount)), 0) INTO v_credits
  FROM public.ledger_entries
  WHERE client_id = p_client_id
    AND amount < 0
    AND (captured_at IS NOT NULL OR payment_status IN ('paid', 'complete', 'captured'));

  v_balance := v_debits - v_credits;
  
  SELECT COUNT(*), MIN(created_at)
  INTO v_outstanding_count, v_oldest_date
  FROM public.ledger_entries
  WHERE client_id = p_client_id
    AND amount > 0
    AND entry_type IN ('invoice', 'late_fee')
    AND (amount - COALESCE(amount_allocated, 0)) > 0.01;

  RETURN QUERY SELECT 
    v_debits,
    v_credits,
    v_balance,
    CASE WHEN v_outstanding_count = 0 AND v_balance < 0 THEN ABS(v_balance) ELSE 0 END,
    v_outstanding_count,
    v_oldest_date;
END;
$$;

-- Trigger to auto-allocate payments when captured
CREATE OR REPLACE FUNCTION public.auto_allocate_payment_on_capture()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.amount < 0 AND NEW.captured_at IS NOT NULL THEN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.captured_at IS NULL) THEN
      PERFORM public.allocate_payment_to_invoices(
        NEW.id,
        NEW.created_by_id,
        COALESCE(NEW.created_by_name, 'System'),
        COALESCE(NEW.created_by_role, 'system')
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_allocate_payment ON public.ledger_entries;
CREATE TRIGGER trg_auto_allocate_payment
  AFTER INSERT OR UPDATE OF captured_at ON public.ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_allocate_payment_on_capture();

-- Function to get allocation history
CREATE OR REPLACE FUNCTION public.get_invoice_payment_history(p_invoice_entry_id UUID)
RETURNS TABLE(
  allocation_id UUID,
  payment_entry_id UUID,
  payment_reference TEXT,
  payment_method TEXT,
  amount_allocated NUMERIC,
  allocated_at TIMESTAMP WITH TIME ZONE,
  allocated_by_name TEXT
)
LANGUAGE plpgsql
STABLE
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lia.id,
    lia.payment_entry_id,
    le.reference_number,
    le.payment_method,
    lia.amount_allocated,
    lia.allocated_at,
    lia.created_by_name
  FROM public.ledger_invoice_allocations lia
  JOIN public.ledger_entries le ON le.id = lia.payment_entry_id
  WHERE lia.invoice_entry_id = p_invoice_entry_id
  ORDER BY lia.allocated_at ASC;
END;
$$;

-- Manual allocation function
CREATE OR REPLACE FUNCTION public.allocate_payment_to_invoice(
  p_payment_entry_id UUID,
  p_invoice_entry_id UUID,
  p_amount NUMERIC,
  p_actor_id UUID DEFAULT NULL,
  p_actor_name TEXT DEFAULT 'Admin',
  p_actor_role TEXT DEFAULT 'admin',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_payment RECORD;
  v_invoice RECORD;
  v_payment_remaining NUMERIC;
  v_invoice_remaining NUMERIC;
BEGIN
  SELECT * INTO v_payment FROM public.ledger_entries WHERE id = p_payment_entry_id AND amount < 0;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid payment entry');
  END IF;
  
  SELECT * INTO v_invoice FROM public.ledger_entries WHERE id = p_invoice_entry_id AND amount > 0;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invoice entry');
  END IF;
  
  IF v_payment.client_id != v_invoice.client_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client mismatch');
  END IF;
  
  v_payment_remaining := ABS(v_payment.amount) - COALESCE(v_payment.amount_allocated, 0);
  v_invoice_remaining := v_invoice.amount - COALESCE(v_invoice.amount_allocated, 0);
  
  IF p_amount > v_payment_remaining THEN
    RETURN jsonb_build_object('success', false, 'error', 'Exceeds payment balance');
  END IF;
  
  IF p_amount > v_invoice_remaining THEN
    RETURN jsonb_build_object('success', false, 'error', 'Exceeds invoice balance');
  END IF;
  
  INSERT INTO public.ledger_invoice_allocations (
    payment_entry_id, invoice_entry_id, amount_allocated,
    created_by_id, created_by_name, created_by_role, notes
  ) VALUES (
    p_payment_entry_id, p_invoice_entry_id, p_amount,
    p_actor_id, p_actor_name, p_actor_role, p_notes
  )
  ON CONFLICT (payment_entry_id, invoice_entry_id) DO UPDATE
  SET amount_allocated = ledger_invoice_allocations.amount_allocated + p_amount,
      allocated_at = now(),
      notes = COALESCE(p_notes, ledger_invoice_allocations.notes);
  
  UPDATE public.ledger_entries
  SET amount_allocated = COALESCE(amount_allocated, 0) + p_amount
  WHERE id IN (p_payment_entry_id, p_invoice_entry_id);
  
  RETURN jsonb_build_object(
    'success', true,
    'amount_allocated', p_amount,
    'payment_remaining', v_payment_remaining - p_amount,
    'invoice_remaining', v_invoice_remaining - p_amount
  );
END;
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ledger_entries_client_allocation ON public.ledger_entries (client_id, entry_type, amount_allocated) WHERE amount > 0;
CREATE INDEX IF NOT EXISTS idx_ledger_allocations_payment ON public.ledger_invoice_allocations (payment_entry_id);
CREATE INDEX IF NOT EXISTS idx_ledger_allocations_invoice ON public.ledger_invoice_allocations (invoice_entry_id);