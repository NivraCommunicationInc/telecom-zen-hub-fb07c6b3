-- 1. Fix get_automatic_email_identity: entity_id must be TEXT to match email_queue column
CREATE OR REPLACE FUNCTION public.get_automatic_email_identity(
  p_event_key text,
  p_template_key text,
  p_template_vars jsonb,
  p_entity_type text DEFAULT NULL,
  p_entity_id text DEFAULT NULL
)
RETURNS TABLE(event_scope text, event_type text, event_version text, is_manual boolean, is_target boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_template TEXT := lower(coalesce(p_template_key, ''));
  v_event TEXT := lower(coalesce(p_event_key, ''));
  v_vars JSONB := coalesce(p_template_vars, '{}'::jsonb);
  v_order_id TEXT;
  v_invoice_id TEXT;
  v_payment_id TEXT;
  v_appointment_id TEXT;
  v_sched TEXT;
  v_status TEXT;
  v_is_manual boolean;
  v_event_scope text;
  v_event_type text;
  v_event_version text;
  v_is_target boolean;
BEGIN
  v_is_manual := (
    lower(coalesce(v_vars->>'manual_send', 'false')) IN ('1', 't', 'true', 'yes')
  ) OR v_event LIKE 'manual_%';

  v_event_scope := NULL;
  v_event_type := NULL;
  v_event_version := 'v1';
  v_is_target := false;

  IF v_template IN ('order_submitted', 'order_confirmation') OR v_event LIKE 'order_confirmation_%' THEN
    v_event_type := 'order_confirmed';
    v_is_target := true;
  ELSIF v_template = 'order_completed' THEN
    v_event_type := 'order_completed';
    v_is_target := true;
  ELSIF v_template IN ('payment_confirmed', 'payment_received', 'payment_receipt') THEN
    v_event_type := 'payment_confirmed';
    v_is_target := true;
  ELSIF v_template IN ('appointment_scheduled', 'appointment_confirmed') THEN
    v_event_type := 'appointment_confirmed';
    v_is_target := true;
  ELSIF v_template = 'appointment_updated' THEN
    v_event_type := 'appointment_changed';
    v_is_target := true;
  ELSIF v_template IN ('invoice_created', 'invoice_sent') THEN
    v_event_type := 'invoice_sent';
    v_is_target := true;
  END IF;

  IF NOT v_is_target THEN
    RETURN QUERY SELECT v_event_scope, v_event_type, v_event_version, v_is_manual, v_is_target;
    RETURN;
  END IF;

  v_order_id := CASE WHEN p_entity_type = 'order' THEN p_entity_id ELSE NULL END;
  v_order_id := coalesce(v_order_id, v_vars->>'order_id',
    CASE WHEN v_event LIKE 'order_%' THEN regexp_replace(v_event, '^order_[a-z]+_', '') ELSE NULL END
  );
  v_invoice_id := coalesce(v_vars->>'invoice_id', v_vars->>'billing_invoice_id');
  v_payment_id := coalesce(v_vars->>'payment_id', v_vars->>'provider_payment_id');
  v_appointment_id := v_vars->>'appointment_id';

  IF v_event_type IN ('order_confirmed', 'order_completed') THEN
    v_event_scope := coalesce('order:' || v_order_id, 'event:' || md5(v_event || '|' || v_template));
  ELSIF v_event_type = 'payment_confirmed' THEN
    v_event_scope := coalesce(
      CASE WHEN v_invoice_id IS NOT NULL THEN 'invoice:' || v_invoice_id END,
      CASE WHEN v_payment_id IS NOT NULL THEN 'payment:' || v_payment_id END,
      CASE WHEN v_order_id IS NOT NULL THEN 'order:' || v_order_id END,
      'event:' || md5(v_event || '|' || v_template)
    );
    v_event_version := coalesce(nullif(v_vars->>'invoice_number', ''), nullif(v_vars->>'payment_reference', ''), nullif(v_invoice_id, ''), nullif(v_payment_id, ''), 'v1');
  ELSIF v_event_type = 'invoice_sent' THEN
    v_event_scope := coalesce(
      CASE WHEN v_invoice_id IS NOT NULL THEN 'invoice:' || v_invoice_id END,
      'event:' || md5(v_event || '|' || v_template)
    );
    v_event_version := coalesce(nullif(v_vars->>'invoice_number', ''), 'v1');
  ELSIF v_event_type IN ('appointment_confirmed', 'appointment_changed') THEN
    v_event_scope := coalesce(
      CASE WHEN v_appointment_id IS NOT NULL THEN 'appointment:' || v_appointment_id END,
      'event:' || md5(v_event || '|' || v_template)
    );
    v_sched := coalesce(nullif(v_vars->>'scheduled_at', ''), nullif(v_vars->>'appointment_date', ''), 'v1');
    v_status := coalesce(nullif(v_vars->>'status', ''),
      CASE WHEN v_event_type = 'appointment_confirmed' THEN 'confirmed' ELSE 'updated' END);
    v_event_version := v_sched || '|' || v_status;
  END IF;

  RETURN QUERY SELECT v_event_scope, v_event_type, v_event_version, v_is_manual, v_is_target;
END;
$$;

-- 2. Drop duplicate triggers that cause double emails
DROP TRIGGER IF EXISTS trg_order_confirmation_email ON orders;
DROP FUNCTION IF EXISTS trigger_order_confirmation_email();

DROP TRIGGER IF EXISTS trigger_ticket_reply_email ON ticket_replies;

-- 3. Recreate dedupe trigger with correct text type
DROP TRIGGER IF EXISTS tr_dedupe_automatic_email_queue ON email_queue;

CREATE OR REPLACE FUNCTION public.trg_dedupe_automatic_email_queue()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_identity RECORD;
  v_registered UUID;
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;

  SELECT * INTO v_identity
  FROM public.get_automatic_email_identity(
    NEW.event_key,
    NEW.template_key,
    NEW.template_vars,
    NEW.entity_type,
    NEW.entity_id
  );

  IF v_identity.is_target IS DISTINCT FROM true OR v_identity.is_manual THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.automatic_email_dispatches (
    event_scope, event_type, event_version,
    source_event_key, template_key, first_email_queue_id
  ) VALUES (
    v_identity.event_scope, v_identity.event_type, v_identity.event_version,
    NEW.event_key, NEW.template_key, NEW.id
  )
  ON CONFLICT (event_scope, event_type, event_version) DO NOTHING
  RETURNING id INTO v_registered;

  IF v_registered IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_dedupe_automatic_email_queue
  BEFORE INSERT ON email_queue
  FOR EACH ROW
  EXECUTE FUNCTION trg_dedupe_automatic_email_queue();