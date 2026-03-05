-- Fix ALL broken trigger functions in one atomic migration

-- 1) sync_invoice_on_payment_change: v_new_status must be billing_invoice_status, not TEXT
CREATE OR REPLACE FUNCTION public.sync_invoice_on_payment_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_paid NUMERIC;
  v_invoice_total NUMERIC;
  v_new_balance NUMERIC;
  v_new_status billing_invoice_status;
BEGIN
  IF NEW.status != 'confirmed' THEN RETURN NEW; END IF;
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM billing_payments WHERE invoice_id = NEW.invoice_id AND status = 'confirmed';
  SELECT total INTO v_invoice_total FROM billing_invoices WHERE id = NEW.invoice_id;
  IF v_invoice_total IS NULL THEN RETURN NEW; END IF;
  v_new_balance := GREATEST(0, v_invoice_total - v_total_paid);
  IF v_new_balance <= 0 THEN v_new_status := 'paid'::billing_invoice_status;
  ELSE v_new_status := 'pending'::billing_invoice_status; END IF;
  UPDATE billing_invoices SET
    amount_paid = v_total_paid, balance_due = v_new_balance, status = v_new_status,
    paid_at = CASE WHEN v_new_balance <= 0 THEN COALESCE(paid_at, NOW()) ELSE NULL END
  WHERE id = NEW.invoice_id;
  RETURN NEW;
END;
$function$;

-- 2) auto_generate_contract_on_payment: fix column names + BEFORE trigger self-update
CREATE OR REPLACE FUNCTION public.auto_generate_contract_on_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contract_number text;
  v_existing_contract_id uuid;
  v_new_contract_id uuid;
  v_idempotency_key text;
BEGIN
  IF (TG_OP = 'UPDATE' AND 
      OLD.payment_status IS DISTINCT FROM NEW.payment_status AND
      NEW.payment_status IN ('captured', 'paid', 'confirmed')) THEN
    NEW.payment_confirmed_at := now();
    SELECT id INTO v_existing_contract_id FROM public.contracts
    WHERE order_id = NEW.id AND status NOT IN ('void', 'superseded') LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF v_existing_contract_id IS NOT NULL THEN RETURN NEW; END IF;
    v_contract_number := (floor(random() * 8) + 2)::text || lpad(floor(random() * 100000000)::text, 8, '0');
    BEGIN
      INSERT INTO public.contracts (
        user_id, owner_user_id, contract_name, contract_url, contract_number,
        order_id, version, status, template_id, template_version, created_at, updated_at
      ) VALUES (
        NEW.user_id, NEW.user_id,
        'Contrat de Service - Commande #' || COALESCE(NEW.order_number, NEW.confirmation_number, NEW.id::text),
        '', v_contract_number, NEW.id, 1, 'waiting_client_signature',
        'contract_template_v2026_02_06', 'v2026.02.07-AutoGen', now(), now()
      ) RETURNING id INTO v_new_contract_id;
    EXCEPTION WHEN unique_violation THEN RETURN NEW;
    END;
    IF NEW.related_contract_id IS NULL THEN
      NEW.related_contract_id := v_new_contract_id;
    END IF;
    v_idempotency_key := 'contract_sig_' || NEW.id::text;
    INSERT INTO public.email_queue (to_email, template_key, template_vars, event_key, idempotency_key, created_at)
    SELECT COALESCE(p.email, NEW.client_email), 'contract_ready_for_signature',
      jsonb_build_object('clientName', COALESCE(p.full_name, 'Client'), 'contractNumber', v_contract_number,
        'contractId', v_new_contract_id, 'orderNumber', COALESCE(NEW.order_number, NEW.confirmation_number),
        'signatureUrl', '/client/contracts/' || v_new_contract_id::text || '/sign'),
      v_idempotency_key, v_idempotency_key, now()
    FROM public.profiles p WHERE p.user_id = NEW.user_id
      AND NOT EXISTS (SELECT 1 FROM public.email_queue eq WHERE eq.idempotency_key = v_idempotency_key);
  END IF;
  RETURN NEW;
END;
$function$;