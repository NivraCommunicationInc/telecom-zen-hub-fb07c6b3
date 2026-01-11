-- Create view for client payment history
DROP VIEW IF EXISTS public.client_payment_history;
CREATE VIEW public.client_payment_history AS
SELECT 
  p.id,
  COALESCE(p.client_id, p.user_id) AS client_id,
  p.invoice_id,
  p.billing_id,
  p.order_id,
  p.amount,
  p.payment_method,
  p.reference_number,
  p.status,
  p.source,
  p.captured_at,
  p.created_at,
  p.created_by_name,
  p.created_by_role,
  b.invoice_number,
  b.balance_due AS invoice_balance_due,
  b.status AS invoice_status
FROM public.payments p
LEFT JOIN public.billing b ON b.id = COALESCE(p.invoice_id, p.billing_id)
ORDER BY p.created_at DESC;

-- Function to update invoice balance when payment is made
CREATE OR REPLACE FUNCTION public.update_invoice_balance_on_payment()
RETURNS TRIGGER AS $$
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
  
  UPDATE public.billing
  SET 
    balance_due = v_new_balance,
    amount_paid = v_total_paid,
    status = CASE WHEN v_new_balance <= 0 THEN 'paid' ELSE status END,
    paid_at = CASE WHEN v_new_balance <= 0 AND paid_at IS NULL THEN NOW() ELSE paid_at END
  WHERE id = v_invoice_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_update_invoice_balance ON public.payments;
CREATE TRIGGER trigger_update_invoice_balance
AFTER INSERT OR UPDATE OF status, amount ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_invoice_balance_on_payment();

-- Function to prevent double payment
CREATE OR REPLACE FUNCTION public.prevent_double_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id uuid;
  v_current_balance numeric;
  v_invoice_status text;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, NEW.billing_id);
  
  IF v_invoice_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  SELECT balance_due, status INTO v_current_balance, v_invoice_status
  FROM public.billing
  WHERE id = v_invoice_id;
  
  IF v_invoice_status = 'paid' AND COALESCE(v_current_balance, 0) <= 0 AND NEW.status IN ('captured', 'completed', 'paid', 'processed') THEN
    RAISE EXCEPTION 'Invoice % is already fully paid. Cannot apply additional payment.', v_invoice_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_prevent_double_payment ON public.payments;
CREATE TRIGGER trigger_prevent_double_payment
BEFORE INSERT ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_double_payment();

-- Function to handle payment with failed order
CREATE OR REPLACE FUNCTION public.record_payment_error_captured(
  p_payment_id uuid,
  p_order_id uuid,
  p_error_reason text
)
RETURNS void AS $$
BEGIN
  UPDATE public.payments
  SET 
    status = 'error_captured',
    order_id = p_order_id,
    error_reason = p_error_reason,
    notes = COALESCE(notes, '') || E'\n[ERROR] Order failed after capture: ' || p_error_reason
  WHERE id = p_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to create ledger entry on payment
CREATE OR REPLACE FUNCTION public.create_ledger_entry_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_client_id uuid;
  v_account_id uuid;
  v_existing_entry_id uuid;
BEGIN
  IF NEW.status NOT IN ('captured', 'completed', 'paid', 'processed') THEN
    RETURN NEW;
  END IF;
  
  SELECT id INTO v_existing_entry_id
  FROM public.ledger_entries
  WHERE reference_type = 'payment' AND reference_id = NEW.id
  LIMIT 1;
  
  IF v_existing_entry_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  v_client_id := COALESCE(NEW.client_id, NEW.user_id);
  
  IF v_client_id IS NULL AND NEW.billing_id IS NOT NULL THEN
    SELECT user_id INTO v_client_id FROM public.billing WHERE id = NEW.billing_id;
  END IF;
  
  IF v_client_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  v_account_id := NEW.account_id;
  IF v_account_id IS NULL THEN
    SELECT a.id INTO v_account_id 
    FROM public.accounts a 
    WHERE a.client_id = v_client_id 
    LIMIT 1;
  END IF;
  
  INSERT INTO public.ledger_entries (
    client_id,
    account_id,
    entry_type,
    amount,
    description,
    reference_type,
    reference_id,
    reference_number,
    payment_method,
    payment_status,
    captured_at,
    created_by_id,
    created_by_name,
    created_by_role
  ) VALUES (
    v_client_id,
    v_account_id,
    'payment'::public.ledger_entry_type,
    -NEW.amount,
    'Paiement reçu - ' || COALESCE(NEW.payment_method, 'N/A'),
    'payment',
    NEW.id,
    NEW.reference_number,
    NEW.payment_method,
    NEW.status,
    COALESCE(NEW.captured_at, NOW()),
    NEW.created_by_id,
    NEW.created_by_name,
    NEW.created_by_role
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_create_ledger_on_payment ON public.payments;
CREATE TRIGGER trigger_create_ledger_on_payment
AFTER INSERT OR UPDATE OF status ON public.payments
FOR EACH ROW
WHEN (NEW.status IN ('captured', 'completed', 'paid', 'processed'))
EXECUTE FUNCTION public.create_ledger_entry_on_payment();

-- Enable realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;