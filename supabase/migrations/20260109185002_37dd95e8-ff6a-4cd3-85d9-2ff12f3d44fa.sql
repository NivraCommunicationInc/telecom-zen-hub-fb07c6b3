
-- Part 1: Fix trigger first

CREATE OR REPLACE FUNCTION public.sync_order_to_ledger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_entry_type ledger_entry_type;
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
    v_captured_at := NOW();
  ELSIF NEW.payment_status IN ('pending', 'verification', 'awaiting_confirmation', 'preauthorized', 'pre_authorized') THEN
    RETURN NEW;
  ELSE
    v_entry_type := 'invoice';
    v_amount := ABS(NEW.total_amount);
    v_description := 'Commande - ' || COALESCE(NEW.order_number, NEW.id::TEXT);
    v_payment_status := NEW.payment_status;
    v_captured_at := NULL;
  END IF;

  INSERT INTO ledger_entries (
    client_id, entry_type, amount, description, reference_type, reference_id, reference_number, payment_status, captured_at
  ) VALUES (
    NEW.user_id, v_entry_type, v_amount, v_description, 'order', NEW.id, NEW.order_number, v_payment_status, v_captured_at
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
$function$;


-- Part 2: Add fingerprint column

ALTER TABLE public.payment_methods 
ADD COLUMN IF NOT EXISTS payment_fingerprint TEXT;


-- Part 3: Create index

CREATE INDEX IF NOT EXISTS idx_payment_methods_fingerprint 
ON public.payment_methods(user_id, payment_fingerprint);
