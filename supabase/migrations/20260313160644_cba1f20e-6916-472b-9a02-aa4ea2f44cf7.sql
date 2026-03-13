
-- Guard: sync_order_to_ledger must never insert NULL amount
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

  -- ★ GUARD: If total_amount is NULL or NaN, skip ledger entry entirely
  IF NEW.total_amount IS NULL OR NEW.total_amount != NEW.total_amount THEN
    RAISE WARNING '[sync_order_to_ledger] Skipping: total_amount is NULL for order %', NEW.id;
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

-- Guard: create_ledger_entry_on_payment must never insert NULL amount
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

  -- ★ GUARD: If amount is NULL, skip ledger entry entirely
  IF NEW.amount IS NULL THEN
    RAISE WARNING '[create_ledger_entry_on_payment] Skipping: amount is NULL for payment %', NEW.id;
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

-- Guard: sync_billing_to_ledger must never insert NULL amount
CREATE OR REPLACE FUNCTION public.sync_billing_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  v_entry_type public.ledger_entry_type;
  v_amount NUMERIC;
  v_description TEXT;
  v_payment_status TEXT;
  v_captured_at TIMESTAMPTZ;
BEGIN
  -- ★ GUARD: If amount is NULL, skip ledger entry entirely
  IF NEW.amount IS NULL THEN
    RAISE WARNING '[sync_billing_to_ledger] Skipping: amount is NULL for billing %', NEW.id;
    RETURN NEW;
  END IF;

  -- Determine entry type based on billing status
  IF NEW.status IN ('paid', 'complete', 'captured', 'confirmed') THEN
    v_entry_type := 'payment'::public.ledger_entry_type;
    v_amount := -ABS(NEW.amount);
    v_description := 'Paiement - ' || COALESCE(NEW.invoice_number, NEW.id::TEXT);
    v_payment_status := NEW.status;
    v_captured_at := COALESCE(NEW.captured_at, NEW.paid_at, NOW());
  ELSIF NEW.status IN ('pending', 'verification', 'awaiting_confirmation') THEN
    RETURN NEW;
  ELSE
    v_entry_type := 'invoice'::public.ledger_entry_type;
    v_amount := ABS(NEW.amount);
    v_description := 'Facture - ' || COALESCE(NEW.invoice_number, NEW.id::TEXT);
    v_payment_status := NEW.status;
    v_captured_at := NULL;
  END IF;

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
