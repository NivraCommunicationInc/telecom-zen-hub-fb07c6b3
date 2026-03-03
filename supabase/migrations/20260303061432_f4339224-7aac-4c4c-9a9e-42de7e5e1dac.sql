-- Server-side trigger: guarantee order confirmation email is sent
-- This catches cases where the frontend call fails (user closes page)

CREATE OR REPLACE FUNCTION public.trigger_order_confirmation_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_email TEXT;
  v_client_name TEXT;
  v_order_number TEXT;
  v_event_key TEXT;
  v_existing_id UUID;
BEGIN
  -- Only trigger on new orders with status 'pending' or 'confirmed'
  IF TG_OP = 'INSERT' AND NEW.status IN ('pending', 'confirmed', 'processing') THEN
    
    v_order_number := NEW.order_number;
    v_event_key := 'order_confirmation_' || NEW.id::text;
    
    -- Check if already queued (idempotent)
    SELECT id INTO v_existing_id
    FROM email_queue
    WHERE event_key = v_event_key
    LIMIT 1;
    
    IF v_existing_id IS NOT NULL THEN
      RETURN NEW; -- Already queued, skip
    END IF;
    
    -- Get client info
    SELECT 
      COALESCE(p.email, NEW.client_email) as email,
      COALESCE(p.full_name, NEW.client_name, 'Client') as name
    INTO v_client_email, v_client_name
    FROM profiles p
    WHERE p.id = NEW.user_id;
    
    -- Fallback to order fields if profile not found
    IF v_client_email IS NULL THEN
      v_client_email := NEW.client_email;
      v_client_name := COALESCE(NEW.client_name, 'Client');
    END IF;
    
    -- Only queue if we have an email
    IF v_client_email IS NOT NULL AND v_client_email != '' THEN
      INSERT INTO email_queue (
        event_key,
        to_email,
        template_key,
        template_vars,
        status,
        attempts,
        max_attempts
      ) VALUES (
        v_event_key,
        v_client_email,
        'order_submitted',
        jsonb_build_object(
          'client_name', v_client_name,
          'client_email', v_client_email,
          'order_id', NEW.id,
          'order_number', v_order_number,
          'service_type', COALESCE(NEW.service_type, 'Service Nivra'),
          'total_amount', COALESCE(NEW.total_amount, 0)
        ),
        'queued',
        0,
        3
      )
      ON CONFLICT DO NOTHING; -- Extra safety for idempotency
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on orders table (server-side guarantee)
DROP TRIGGER IF EXISTS trg_order_confirmation_email ON orders;
CREATE TRIGGER trg_order_confirmation_email
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_order_confirmation_email();

-- Also create a trigger for payment confirmation → receipt email
CREATE OR REPLACE FUNCTION public.trigger_payment_receipt_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_email TEXT;
  v_client_name TEXT;
  v_invoice_number TEXT;
  v_event_key TEXT;
  v_existing_id UUID;
BEGIN
  -- Only trigger when payment status becomes confirmed/captured
  IF (TG_OP = 'UPDATE' AND NEW.status IN ('confirmed', 'captured') 
      AND (OLD.status IS DISTINCT FROM NEW.status)) THEN
    
    v_event_key := 'payment_receipt_' || NEW.id::text;
    
    -- Check if already queued
    SELECT id INTO v_existing_id
    FROM email_queue WHERE event_key = v_event_key LIMIT 1;
    
    IF v_existing_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    
    -- Get invoice number
    SELECT invoice_number INTO v_invoice_number
    FROM billing_invoices WHERE id = NEW.invoice_id;
    
    -- Get customer info
    SELECT bc.email, CONCAT(bc.first_name, ' ', bc.last_name)
    INTO v_client_email, v_client_name
    FROM billing_customers bc WHERE bc.id = NEW.customer_id;
    
    IF v_client_email IS NOT NULL AND v_client_email != '' THEN
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

DROP TRIGGER IF EXISTS trg_payment_receipt_email ON billing_payments;
CREATE TRIGGER trg_payment_receipt_email
  AFTER UPDATE ON billing_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_payment_receipt_email();