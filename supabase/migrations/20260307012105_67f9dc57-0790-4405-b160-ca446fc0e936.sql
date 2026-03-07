-- Canonical billing reconciliation hardening (global)

-- 1) Fix payment receipt trigger: remove invalid enum value 'captured'
CREATE OR REPLACE FUNCTION public.trigger_payment_receipt_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_email TEXT;
  v_client_name TEXT;
  v_invoice_number TEXT;
  v_event_key TEXT;
  v_existing_id UUID;
BEGIN
  -- Only trigger when payment status becomes confirmed
  IF (
    TG_OP = 'UPDATE'
    AND NEW.status = 'confirmed'
    AND (OLD.status IS DISTINCT FROM NEW.status)
  ) THEN

    v_event_key := 'payment_receipt_' || NEW.id::text;

    SELECT id INTO v_existing_id
    FROM email_queue
    WHERE event_key = v_event_key
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN NEW;
    END IF;

    SELECT invoice_number INTO v_invoice_number
    FROM billing_invoices
    WHERE id = NEW.invoice_id;

    SELECT bc.email, CONCAT(bc.first_name, ' ', bc.last_name)
    INTO v_client_email, v_client_name
    FROM billing_customers bc
    WHERE bc.id = NEW.customer_id;

    IF v_client_email IS NOT NULL AND v_client_email <> '' THEN
      INSERT INTO email_queue (
        event_key, to_email, template_key, template_vars,
        status, attempts, max_attempts
      ) VALUES (
        v_event_key, v_client_email, 'payment_receipt',
        jsonb_build_object(
          'client_name', COALESCE(v_client_name, 'Client'),
          'invoice_number', COALESCE(v_invoice_number, ''),
          'amount_paid', NEW.amount,
          'payment_method', NEW.method,
          'payment_reference', COALESCE(NEW.reference, NEW.provider_payment_id, ''),
          'paid_at', COALESCE(NEW.received_at, now()::text)
        ),
        'queued', 0, 3
      ) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Canonical invoice reconciliation logic from confirmed payments
CREATE OR REPLACE FUNCTION public.reconcile_invoice_from_payments(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invoice RECORD;
  v_paid NUMERIC := 0;
  v_old_status TEXT;
  v_new_status TEXT;
  v_old_amount_paid NUMERIC := 0;
  v_old_balance_due NUMERIC := 0;
  v_new_balance_due NUMERIC := 0;
  v_order_payment_status TEXT;
BEGIN
  SELECT id, total, status::text, order_id,
         COALESCE(amount_paid, 0) AS amount_paid,
         COALESCE(balance_due, total) AS balance_due
  INTO v_invoice
  FROM billing_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invoice_not_found');
  END IF;

  v_old_status := v_invoice.status;
  v_old_amount_paid := v_invoice.amount_paid;
  v_old_balance_due := v_invoice.balance_due;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_paid
  FROM billing_payments
  WHERE invoice_id = p_invoice_id
    AND status = 'confirmed';

  v_new_balance_due := GREATEST(COALESCE(v_invoice.total, 0) - v_paid, 0);

  IF v_old_status IN ('void', 'cancelled', 'refunded') THEN
    v_new_status := v_old_status;
  ELSIF v_new_balance_due <= 0 AND COALESCE(v_invoice.total, 0) > 0 THEN
    v_new_status := 'paid';
  ELSIF v_paid > 0 THEN
    v_new_status := 'partially_paid';
  ELSE
    v_new_status := CASE WHEN v_old_status = 'overdue' THEN 'overdue' ELSE 'pending' END;
  END IF;

  UPDATE billing_invoices
  SET
    amount_paid = v_paid,
    balance_due = v_new_balance_due,
    status = v_new_status::billing_invoice_status,
    paid_at = CASE
      WHEN v_new_status = 'paid' THEN COALESCE(paid_at, NOW())
      ELSE NULL
    END
  WHERE id = p_invoice_id;

  -- Sync linked order payment_status from canonical invoice state
  IF v_invoice.order_id IS NOT NULL THEN
    v_order_payment_status := CASE
      WHEN v_new_status = 'paid' THEN 'paid'
      WHEN v_new_status = 'partially_paid' THEN 'partial'
      ELSE 'pending'
    END;

    UPDATE orders
    SET payment_status = v_order_payment_status,
        updated_at = NOW()
    WHERE id = v_invoice.order_id
      AND COALESCE(payment_status, '') <> v_order_payment_status;
  END IF;

  RETURN jsonb_build_object(
    'invoice_id', p_invoice_id,
    'old_status', v_old_status,
    'new_status', v_new_status,
    'total', v_invoice.total,
    'amount_paid', v_paid,
    'balance_due', v_new_balance_due,
    'changed', (
      v_old_status IS DISTINCT FROM v_new_status
      OR v_old_amount_paid IS DISTINCT FROM v_paid
      OR v_old_balance_due IS DISTINCT FROM v_new_balance_due
    )
  );
END;
$$;

-- 3) Ensure payment-table trigger uses canonical reconciliation only
CREATE OR REPLACE FUNCTION public.sync_invoice_amount_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target_invoice_id UUID;
BEGIN
  v_target_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  IF v_target_invoice_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM public.reconcile_invoice_from_payments(v_target_invoice_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4) Remove duplicate/legacy sync trigger to avoid double reconciliation and race conditions
DROP TRIGGER IF EXISTS trg_sync_invoice_on_payment ON public.billing_payments;