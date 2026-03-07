-- Structural event-level idempotency hardening for automatic lifecycle emails
-- Goal: ONE real business event occurrence = ONE automatic email

-- 1) Canonical event identity resolver (business-event based, not recipient-based)
CREATE OR REPLACE FUNCTION public.get_automatic_email_identity(
  p_event_key text,
  p_template_key text,
  p_template_vars jsonb,
  p_entity_type text DEFAULT NULL,
  p_entity_id text DEFAULT NULL
)
RETURNS TABLE(
  event_scope text,
  event_type text,
  event_version text,
  is_manual boolean,
  is_target boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_template text := lower(coalesce(p_template_key, ''));
  v_event text := lower(coalesce(p_event_key, ''));
  v_vars jsonb := coalesce(p_template_vars, '{}'::jsonb);

  v_order_id text;
  v_invoice_id text;
  v_payment_id text;
  v_appointment_id text;
  v_invoice_number text;

  v_sched text;
  v_status text;
  v_is_security boolean;
BEGIN
  is_manual := (
    lower(coalesce(v_vars->>'manual_send', 'false')) IN ('1', 't', 'true', 'yes')
  ) OR v_event LIKE 'manual_%';

  -- Explicit bypass for security/authentication flows
  v_is_security :=
    v_template ~ '(otp|pin|magic|password|auth|login|verify|verification|2fa|mfa|security)'
    OR v_event ~ '(otp|pin|magic|password|auth|login|verify|verification|2fa|mfa|security)'
    OR lower(coalesce(v_vars->>'message_type', '')) ~ '(otp|pin|magic|password|auth|login|verify|verification|2fa|mfa|security)';

  event_scope := NULL;
  event_type := NULL;
  event_version := 'v1';
  is_target := false;

  IF is_manual OR v_is_security THEN
    RETURN QUERY SELECT event_scope, event_type, event_version, is_manual, is_target;
    RETURN;
  END IF;

  -- Target automatic lifecycle families only
  IF v_template IN ('order_submitted', 'order_confirmation')
     OR v_event LIKE 'order_confirmation_%'
     OR v_event LIKE 'order_submitted_%'
  THEN
    event_type := 'order_confirmed';
    is_target := true;

  ELSIF v_template = 'order_completed'
     OR v_event LIKE 'order_completed_%'
     OR v_event LIKE 'order_status_%'
  THEN
    event_type := 'order_completed';
    is_target := true;

  ELSIF v_template IN ('payment_confirmed', 'payment_received', 'payment_receipt')
     OR v_event LIKE 'payment_confirmed_%'
     OR v_event LIKE 'payment_received_%'
     OR v_event LIKE 'payment_receipt_%'
  THEN
    event_type := 'payment_confirmed';
    is_target := true;

  ELSIF v_template IN ('appointment_scheduled', 'appointment_confirmed')
     OR v_event LIKE 'appointment_confirmed_%'
     OR v_event LIKE 'appointment_scheduled_%'
  THEN
    event_type := 'appointment_confirmed';
    is_target := true;

  ELSIF v_template = 'appointment_updated'
     OR v_event LIKE 'appointment_updated_%'
     OR v_event LIKE 'appointment_rescheduled_%'
  THEN
    event_type := 'appointment_changed';
    is_target := true;

  ELSIF v_template IN ('invoice_created', 'invoice_sent')
     OR v_event LIKE 'invoice_created_%'
     OR v_event LIKE 'invoice_sent_%'
  THEN
    event_type := 'invoice_sent';
    is_target := true;
  END IF;

  IF NOT is_target THEN
    RETURN QUERY SELECT event_scope, event_type, event_version, is_manual, is_target;
    RETURN;
  END IF;

  -- Identity extraction (entity ids first, then vars, then event_key)
  v_order_id := coalesce(
    CASE WHEN p_entity_type = 'order' THEN p_entity_id END,
    nullif(v_vars->>'order_id', ''),
    nullif(v_vars->>'orderId', ''),
    substring(v_event from '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
  );

  v_invoice_id := coalesce(
    CASE WHEN p_entity_type IN ('invoice', 'billing_invoice') THEN p_entity_id END,
    nullif(v_vars->>'invoice_id', ''),
    nullif(v_vars->>'billing_invoice_id', ''),
    nullif(v_vars->>'invoiceId', ''),
    CASE WHEN p_entity_type = 'payment' THEN nullif(v_vars->>'invoice_id', '') END
  );

  v_payment_id := coalesce(
    CASE WHEN p_entity_type = 'payment' THEN p_entity_id END,
    nullif(v_vars->>'payment_id', ''),
    nullif(v_vars->>'provider_payment_id', ''),
    nullif(v_vars->>'paymentId', '')
  );

  v_appointment_id := coalesce(
    CASE WHEN p_entity_type = 'appointment' THEN p_entity_id END,
    nullif(v_vars->>'appointment_id', ''),
    nullif(v_vars->>'appointmentId', ''),
    substring(v_event from '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
  );

  v_invoice_number := coalesce(
    nullif(v_vars->>'invoice_number', ''),
    nullif(v_vars->>'invoiceNumber', '')
  );

  IF event_type IN ('order_confirmed', 'order_completed') THEN
    event_scope := coalesce(
      CASE WHEN v_order_id IS NOT NULL THEN 'order:' || v_order_id END,
      'event:' || md5(v_event || '|' || v_template)
    );

    v_status := coalesce(
      nullif(v_vars->>'new_status', ''),
      nullif(v_vars->>'status', ''),
      substring(v_event from '^order_status_[0-9a-f-]+_([a-z_]+)'),
      CASE WHEN event_type = 'order_completed' THEN 'completed' ELSE 'confirmed' END
    );

    -- Normalize terminal states that map to the same lifecycle completion message
    IF v_status IN ('delivered', 'activated', 'installed', 'completed_installation') THEN
      v_status := 'completed';
    END IF;

    IF event_type = 'order_completed' AND (v_status IS NULL OR btrim(v_status) = '') THEN
      v_status := 'completed';
    END IF;

    IF event_type = 'order_confirmed' AND (v_status IS NULL OR btrim(v_status) = '') THEN
      v_status := 'confirmed';
    END IF;

    event_version := coalesce(v_status, 'v1');

  ELSIF event_type = 'payment_confirmed' THEN
    event_scope := coalesce(
      CASE WHEN v_invoice_id IS NOT NULL THEN 'invoice:' || v_invoice_id END,
      CASE WHEN v_invoice_number IS NOT NULL THEN 'invoice_number:' || v_invoice_number END,
      CASE WHEN v_payment_id IS NOT NULL THEN 'payment:' || v_payment_id END,
      CASE WHEN v_order_id IS NOT NULL THEN 'order:' || v_order_id END,
      'event:' || md5(v_event || '|' || v_template)
    );

    -- Keep a stable lifecycle version across all automatic sources for the same payment event
    event_version := 'confirmed';

  ELSIF event_type = 'invoice_sent' THEN
    event_scope := coalesce(
      CASE WHEN v_invoice_id IS NOT NULL THEN 'invoice:' || v_invoice_id END,
      CASE WHEN v_invoice_number IS NOT NULL THEN 'invoice_number:' || v_invoice_number END,
      CASE WHEN v_order_id IS NOT NULL THEN 'order:' || v_order_id END,
      'event:' || md5(v_event || '|' || v_template)
    );

    event_version := 'sent';

  ELSIF event_type IN ('appointment_confirmed', 'appointment_changed') THEN
    event_scope := coalesce(
      CASE WHEN v_appointment_id IS NOT NULL THEN 'appointment:' || v_appointment_id END,
      CASE WHEN v_order_id IS NOT NULL THEN 'order:' || v_order_id END,
      'event:' || md5(v_event || '|' || v_template)
    );

    v_sched := coalesce(
      nullif(v_vars->>'scheduled_at', ''),
      nullif(v_vars->>'appointment_date', ''),
      nullif(v_vars->>'appointmentDate', ''),
      'v1'
    );

    v_status := coalesce(
      nullif(v_vars->>'new_status', ''),
      nullif(v_vars->>'status', ''),
      substring(v_event from '^appointment_updated_[0-9a-f-]+_([a-z_]+)'),
      CASE WHEN event_type = 'appointment_confirmed' THEN 'confirmed' ELSE 'updated' END
    );

    event_version := v_sched || '|' || coalesce(v_status, 'updated');
  END IF;

  RETURN QUERY SELECT event_scope, event_type, event_version, is_manual, is_target;
END;
$$;

-- 2) Ensure payment receipt emails carry invoice identity for cross-source dedupe
CREATE OR REPLACE FUNCTION public.trigger_payment_receipt_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
        event_key,
        to_email,
        template_key,
        template_vars,
        status,
        attempts,
        max_attempts,
        entity_type,
        entity_id
      ) VALUES (
        v_event_key,
        v_client_email,
        'payment_receipt',
        jsonb_build_object(
          'client_name', COALESCE(v_client_name, 'Client'),
          'invoice_id', NEW.invoice_id,
          'invoice_number', COALESCE(v_invoice_number, ''),
          'amount_paid', NEW.amount,
          'payment_method', NEW.method,
          'payment_reference', COALESCE(NEW.reference, NEW.provider_payment_id, ''),
          'paid_at', COALESCE(NEW.received_at::text, now()::text),
          'status', 'confirmed'
        ),
        'queued',
        0,
        3,
        'invoice',
        NEW.invoice_id::text
      ) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;