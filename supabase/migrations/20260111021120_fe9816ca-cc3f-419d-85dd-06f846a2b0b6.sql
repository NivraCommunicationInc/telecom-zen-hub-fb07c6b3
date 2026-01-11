-- Fix the sync_billing_to_ledger function to cast entry_type properly
CREATE OR REPLACE FUNCTION public.sync_billing_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  v_entry_type public.ledger_entry_type;
  v_amount NUMERIC;
  v_description TEXT;
  v_payment_status TEXT;
  v_captured_at TIMESTAMPTZ;
BEGIN
  -- Determine entry type based on billing status
  IF NEW.status IN ('paid', 'complete', 'captured', 'confirmed') THEN
    -- This is a confirmed payment - create credit entry (negative)
    v_entry_type := 'payment'::public.ledger_entry_type;
    v_amount := -ABS(NEW.amount); -- Credits are negative
    v_description := 'Paiement - ' || COALESCE(NEW.invoice_number, NEW.id::TEXT);
    v_payment_status := NEW.status;
    v_captured_at := COALESCE(NEW.captured_at, NEW.paid_at, NOW());
  ELSIF NEW.status IN ('pending', 'verification', 'awaiting_confirmation') THEN
    -- PENDING/VERIFICATION payments do NOT create ledger entries
    RETURN NEW;
  ELSE
    -- Invoice/charge - create debit entry (positive)
    v_entry_type := 'invoice'::public.ledger_entry_type;
    v_amount := ABS(NEW.amount); -- Debits are positive
    v_description := 'Facture - ' || COALESCE(NEW.invoice_number, NEW.id::TEXT);
    v_payment_status := NEW.status;
    v_captured_at := NULL;
  END IF;

  -- Idempotent UPSERT
  INSERT INTO public.ledger_entries (
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;