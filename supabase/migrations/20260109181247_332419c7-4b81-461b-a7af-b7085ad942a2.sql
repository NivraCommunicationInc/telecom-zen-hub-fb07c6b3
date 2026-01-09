-- Fix trigger sync_order_to_ledger: cast entry_type to enum and use valid enum values
-- Valid values: invoice, payment, credit, adjustment, refund, late_fee, promo_credit

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
    v_entry_type := 'payment';  -- Valid enum value
    v_amount := -ABS(NEW.total_amount);
    v_description := 'Paiement commande - ' || COALESCE(NEW.order_number, NEW.id::TEXT);
    v_payment_status := NEW.payment_status;
    v_captured_at := COALESCE(NEW.paid_at, NOW());
  ELSIF NEW.payment_status IN ('pending', 'verification', 'awaiting_confirmation', 'preauthorized', 'pre_authorized') THEN
    -- PENDING/PREAUTHORIZED do NOT create ledger entries - skip completely
    RETURN NEW;
  ELSE
    -- Order charge - use 'invoice' as the debit entry type (not 'order' which doesn't exist)
    v_entry_type := 'invoice';  -- Valid enum value for order charges
    v_amount := ABS(NEW.total_amount);
    v_description := 'Commande - ' || COALESCE(NEW.order_number, NEW.id::TEXT);
    v_payment_status := NEW.payment_status;
    v_captured_at := NULL;
  END IF;

  -- Idempotent UPSERT with proper enum type
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
    v_entry_type,  -- Now properly typed as ledger_entry_type
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
$function$;