-- ========================================
-- AUTO-CREATE LEDGER ENTRIES TRIGGERS
-- ========================================

-- 1. Attach sync_billing_to_ledger trigger to billing table
DROP TRIGGER IF EXISTS trg_sync_billing_to_ledger ON public.billing;
CREATE TRIGGER trg_sync_billing_to_ledger
  BEFORE INSERT OR UPDATE ON public.billing
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_billing_to_ledger();

-- 2. Create trigger for monthly_invoices -> ledger
CREATE OR REPLACE FUNCTION public.sync_monthly_invoice_to_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_existing_entry_id UUID;
  v_is_captured BOOLEAN;
BEGIN
  -- Determine if this is a captured payment
  v_is_captured := public.is_payment_captured(NEW.status, NULL, NEW.paid_at);
  
  IF TG_OP = 'INSERT' THEN
    -- Create debit entry for the invoice
    INSERT INTO public.ledger_entries (
      client_id, account_id, entry_type, amount, description,
      reference_type, reference_id, reference_number,
      payment_method, payment_status, created_at
    ) VALUES (
      NEW.client_id,
      NEW.account_id,
      'invoice'::ledger_entry_type,
      NEW.total,
      'Facture mensuelle #' || COALESCE(NEW.invoice_number, NEW.id::TEXT),
      'monthly_invoice',
      NEW.id,
      NEW.invoice_number,
      NEW.payment_method,
      NEW.status,
      NEW.issue_date
    );
  END IF;
  
  -- When payment status changes to captured
  IF TG_OP = 'UPDATE' AND v_is_captured AND NOT public.is_payment_captured(OLD.status, NULL, OLD.paid_at) THEN
    -- Check if payment entry already exists
    SELECT id INTO v_existing_entry_id
    FROM public.ledger_entries
    WHERE reference_type = 'monthly_invoice'
      AND reference_id = NEW.id
      AND amount < 0
    LIMIT 1;
    
    IF v_existing_entry_id IS NULL THEN
      -- Create credit entry for the payment
      INSERT INTO public.ledger_entries (
        client_id, account_id, entry_type, amount, description,
        reference_type, reference_id, reference_number,
        payment_method, payment_status, captured_at, created_at
      ) VALUES (
        NEW.client_id,
        NEW.account_id,
        'payment'::ledger_entry_type,
        -COALESCE(NEW.amount_paid, NEW.total),
        'Paiement - Facture #' || COALESCE(NEW.invoice_number, NEW.id::TEXT),
        'monthly_invoice',
        NEW.id,
        NEW.payment_reference,
        NEW.payment_method,
        NEW.status,
        COALESCE(NEW.paid_at, now()),
        now()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_monthly_invoice_to_ledger ON public.monthly_invoices;
CREATE TRIGGER trg_sync_monthly_invoice_to_ledger
  BEFORE INSERT OR UPDATE ON public.monthly_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_monthly_invoice_to_ledger();

-- 3. Create trigger for orders -> ledger (when order payment is confirmed)
CREATE OR REPLACE FUNCTION public.sync_order_to_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_existing_debit_id UUID;
  v_existing_credit_id UUID;
  v_is_captured BOOLEAN;
  v_total_amount NUMERIC;
BEGIN
  -- Calculate total amount
  v_total_amount := COALESCE(NEW.amount_paid, NEW.base_price, 0);
  
  IF v_total_amount <= 0 THEN
    RETURN NEW;
  END IF;
  
  -- Check for existing entries
  SELECT id INTO v_existing_debit_id
  FROM public.ledger_entries
  WHERE reference_type = 'order'
    AND reference_id = NEW.id
    AND amount > 0
  LIMIT 1;
  
  -- Create debit entry for the order if not exists
  IF TG_OP = 'INSERT' AND v_existing_debit_id IS NULL THEN
    INSERT INTO public.ledger_entries (
      client_id, account_id, entry_type, amount, description,
      reference_type, reference_id, reference_number,
      payment_status, created_at
    ) VALUES (
      NEW.user_id,
      NULL,
      'invoice'::ledger_entry_type,
      v_total_amount,
      'Commande #' || COALESCE(NEW.order_number, NEW.id::TEXT),
      'order',
      NEW.id,
      NEW.order_number,
      NEW.status,
      NEW.created_at
    );
  END IF;
  
  -- Check if payment is confirmed
  v_is_captured := NEW.payment_status IN ('paid', 'complete', 'captured') 
                   OR (NEW.status = 'confirmed' AND NEW.payment_status = 'paid');
  
  -- When payment becomes captured
  IF TG_OP = 'UPDATE' AND v_is_captured THEN
    -- Check old status
    IF NOT (OLD.payment_status IN ('paid', 'complete', 'captured') 
            OR (OLD.status = 'confirmed' AND OLD.payment_status = 'paid')) THEN
      -- Check if credit entry already exists
      SELECT id INTO v_existing_credit_id
      FROM public.ledger_entries
      WHERE reference_type = 'order'
        AND reference_id = NEW.id
        AND amount < 0
      LIMIT 1;
      
      IF v_existing_credit_id IS NULL THEN
        -- Create credit entry for the payment
        INSERT INTO public.ledger_entries (
          client_id, account_id, entry_type, amount, description,
          reference_type, reference_id, reference_number,
          payment_method, payment_status, captured_at, created_at
        ) VALUES (
          NEW.user_id,
          NULL,
          'payment'::ledger_entry_type,
          -v_total_amount,
          'Paiement - Commande #' || COALESCE(NEW.order_number, NEW.id::TEXT),
          'order',
          NEW.id,
          NEW.order_number,
          NEW.payment_method,
          NEW.payment_status,
          now(),
          now()
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_order_to_ledger ON public.orders;
CREATE TRIGGER trg_sync_order_to_ledger
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_order_to_ledger();

-- 4. Trigger to auto-allocate when NEW payment is inserted (captured)
CREATE OR REPLACE FUNCTION public.auto_allocate_payment_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Only process credit entries (payments) that are captured
  IF NEW.amount < 0 AND 
     (NEW.captured_at IS NOT NULL OR NEW.payment_status IN ('paid', 'complete', 'captured')) THEN
    -- Call allocation function
    PERFORM public.allocate_payment_to_invoices(NEW.id, NULL, 'System', 'system');
  END IF;
  
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_allocate_payment_on_insert ON public.ledger_entries;
CREATE TRIGGER trg_auto_allocate_payment_on_insert
  AFTER INSERT ON public.ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_allocate_payment_on_insert();

-- 5. Trigger to auto-allocate when NEW invoice is inserted (allocate existing credits)
CREATE OR REPLACE FUNCTION public.auto_allocate_credits_on_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_payment_record RECORD;
BEGIN
  -- Only process debit entries (invoices)
  IF NEW.amount > 0 AND NEW.entry_type IN ('invoice', 'late_fee') THEN
    -- Find all unallocated payments for this client and allocate them
    FOR v_payment_record IN
      SELECT id 
      FROM public.ledger_entries
      WHERE client_id = NEW.client_id
        AND amount < 0
        AND (captured_at IS NOT NULL OR payment_status IN ('paid', 'complete', 'captured'))
        AND (ABS(amount) - COALESCE(amount_allocated, 0)) > 0.01
      ORDER BY created_at ASC
    LOOP
      PERFORM public.allocate_payment_to_invoices(v_payment_record.id, NULL, 'System', 'system');
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_allocate_credits_on_invoice ON public.ledger_entries;
CREATE TRIGGER trg_auto_allocate_credits_on_invoice
  AFTER INSERT ON public.ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_allocate_credits_on_invoice();

-- 6. Function to get allocations for a payment/invoice
CREATE OR REPLACE FUNCTION public.get_ledger_allocations(p_entry_id UUID)
RETURNS TABLE (
  allocation_id UUID,
  other_entry_id UUID,
  other_reference_number TEXT,
  other_description TEXT,
  other_entry_type TEXT,
  amount_allocated NUMERIC,
  allocated_at TIMESTAMPTZ,
  is_payment BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_entry_amount NUMERIC;
BEGIN
  -- Get the entry amount to determine if it's a payment or invoice
  SELECT amount INTO v_entry_amount FROM public.ledger_entries WHERE id = p_entry_id;
  
  IF v_entry_amount < 0 THEN
    -- This is a payment, return invoices it was allocated to
    RETURN QUERY
    SELECT 
      lia.id AS allocation_id,
      lia.invoice_entry_id AS other_entry_id,
      le.reference_number AS other_reference_number,
      le.description AS other_description,
      le.entry_type::TEXT AS other_entry_type,
      lia.amount_allocated,
      lia.allocated_at,
      FALSE AS is_payment
    FROM public.ledger_invoice_allocations lia
    JOIN public.ledger_entries le ON le.id = lia.invoice_entry_id
    WHERE lia.payment_entry_id = p_entry_id
    ORDER BY lia.allocated_at;
  ELSE
    -- This is an invoice, return payments allocated to it
    RETURN QUERY
    SELECT 
      lia.id AS allocation_id,
      lia.payment_entry_id AS other_entry_id,
      le.reference_number AS other_reference_number,
      le.description AS other_description,
      le.entry_type::TEXT AS other_entry_type,
      lia.amount_allocated,
      lia.allocated_at,
      TRUE AS is_payment
    FROM public.ledger_invoice_allocations lia
    JOIN public.ledger_entries le ON le.id = lia.payment_entry_id
    WHERE lia.invoice_entry_id = p_entry_id
    ORDER BY lia.allocated_at;
  END IF;
END;
$function$;

-- 7. Index for faster allocation lookups
CREATE INDEX IF NOT EXISTS idx_ledger_allocations_payment ON public.ledger_invoice_allocations(payment_entry_id);
CREATE INDEX IF NOT EXISTS idx_ledger_allocations_invoice ON public.ledger_invoice_allocations(invoice_entry_id);