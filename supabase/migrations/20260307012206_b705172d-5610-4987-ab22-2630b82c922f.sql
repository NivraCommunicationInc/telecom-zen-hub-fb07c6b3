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
          'paid_at', COALESCE(NEW.received_at::text, now()::text)
        ),
        'queued', 0, 3
      ) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;