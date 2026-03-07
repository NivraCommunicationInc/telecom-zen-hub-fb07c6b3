-- Global automatic email idempotency + dedupe across all insertion paths

-- 1) Canonical dedupe registry for automatic email lifecycle events
CREATE TABLE IF NOT EXISTS public.automatic_email_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_scope TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_version TEXT NOT NULL DEFAULT 'v1',
  source_event_key TEXT NOT NULL,
  template_key TEXT NOT NULL,
  first_email_queue_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_scope, event_type, event_version)
);

ALTER TABLE public.automatic_email_dispatches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view automatic email dispatches" ON public.automatic_email_dispatches;
CREATE POLICY "Admins can view automatic email dispatches"
  ON public.automatic_email_dispatches
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service role manages automatic email dispatches" ON public.automatic_email_dispatches;
CREATE POLICY "Service role manages automatic email dispatches"
  ON public.automatic_email_dispatches
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_automatic_email_dispatches_created_at
  ON public.automatic_email_dispatches(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automatic_email_dispatches_event_type
  ON public.automatic_email_dispatches(event_type, created_at DESC);

-- 2) Helper: extract first UUID from arbitrary text safely
CREATE OR REPLACE FUNCTION public.extract_uuid_from_text(p_text TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_match TEXT;
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN NULL;
  END IF;

  v_match := substring(
    p_text
    FROM '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})'
  );

  IF v_match IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_match::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- 3) Compute normalized automatic-event identity from raw queue payload
CREATE OR REPLACE FUNCTION public.get_automatic_email_identity(
  p_event_key TEXT,
  p_template_key TEXT,
  p_template_vars JSONB,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL
)
RETURNS TABLE (
  event_scope TEXT,
  event_type TEXT,
  event_version TEXT,
  is_manual BOOLEAN,
  is_target BOOLEAN
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_template TEXT := lower(coalesce(p_template_key, ''));
  v_event TEXT := lower(coalesce(p_event_key, ''));
  v_vars JSONB := coalesce(p_template_vars, '{}'::jsonb);

  v_order_id UUID;
  v_invoice_id UUID;
  v_payment_id UUID;
  v_appointment_id UUID;

  v_sched TEXT;
  v_status TEXT;
BEGIN
  is_manual := (
    lower(coalesce(v_vars->>'manual_send', 'false')) IN ('1', 't', 'true', 'yes')
  ) OR v_event LIKE 'manual_%';

  event_scope := NULL;
  event_type := NULL;
  event_version := 'v1';
  is_target := false;

  -- Normalize target event families that must be idempotent platform-wide
  IF v_template IN ('order_submitted', 'order_confirmation') OR v_event LIKE 'order_confirmation_%' THEN
    event_type := 'order_confirmed';
    is_target := true;
  ELSIF v_template = 'order_completed' THEN
    event_type := 'order_completed';
    is_target := true;
  ELSIF v_template IN ('payment_confirmed', 'payment_received', 'payment_receipt') THEN
    event_type := 'payment_confirmed';
    is_target := true;
  ELSIF v_template IN ('appointment_scheduled', 'appointment_confirmed') THEN
    event_type := 'appointment_confirmed';
    is_target := true;
  ELSIF v_template = 'appointment_updated' THEN
    event_type := 'appointment_changed';
    is_target := true;
  END IF;

  IF NOT is_target THEN
    RETURN QUERY SELECT event_scope, event_type, event_version, is_manual, is_target;
    RETURN;
  END IF;

  v_order_id := CASE WHEN p_entity_type = 'order' THEN p_entity_id ELSE NULL END;
  v_order_id := coalesce(
    v_order_id,
    public.extract_uuid_from_text(v_vars->>'order_id'),
    CASE WHEN v_event LIKE 'order_%' OR v_event LIKE 'payment_%' THEN public.extract_uuid_from_text(v_event) ELSE NULL END
  );

  v_invoice_id := coalesce(
    public.extract_uuid_from_text(v_vars->>'invoice_id'),
    public.extract_uuid_from_text(v_vars->>'billing_invoice_id')
  );

  v_payment_id := coalesce(
    public.extract_uuid_from_text(v_vars->>'payment_id'),
    public.extract_uuid_from_text(v_vars->>'provider_payment_id'),
    CASE WHEN v_event LIKE 'payment_%' THEN public.extract_uuid_from_text(v_event) ELSE NULL END
  );

  v_appointment_id := coalesce(
    public.extract_uuid_from_text(v_vars->>'appointment_id'),
    CASE WHEN v_event LIKE 'appointment_%' THEN public.extract_uuid_from_text(v_event) ELSE NULL END
  );

  IF event_type IN ('order_confirmed', 'order_completed') THEN
    event_scope := coalesce('order:' || v_order_id::text, 'event:' || md5(v_event || '|' || v_template));
    event_version := 'v1';

  ELSIF event_type = 'payment_confirmed' THEN
    event_scope := coalesce(
      'invoice:' || v_invoice_id::text,
      'payment:' || v_payment_id::text,
      'order:' || v_order_id::text,
      'event:' || md5(v_event || '|' || v_template)
    );

    event_version := coalesce(
      nullif(v_vars->>'invoice_number', ''),
      nullif(v_vars->>'payment_reference', ''),
      nullif(v_vars->>'reference', ''),
      nullif(v_invoice_id::text, ''),
      nullif(v_payment_id::text, ''),
      'v1'
    );

  ELSIF event_type IN ('appointment_confirmed', 'appointment_changed') THEN
    event_scope := coalesce('appointment:' || v_appointment_id::text, 'event:' || md5(v_event || '|' || v_template));

    v_sched := coalesce(
      nullif(v_vars->>'scheduled_at', ''),
      nullif(v_vars->>'appointment_date', ''),
      nullif(v_vars->>'appointmentDate', ''),
      'v1'
    );

    v_status := coalesce(
      nullif(v_vars->>'status', ''),
      CASE WHEN event_type = 'appointment_confirmed' THEN 'confirmed' ELSE 'updated' END
    );

    event_version := v_sched || '|' || v_status;
  END IF;

  RETURN QUERY SELECT event_scope, event_type, event_version, is_manual, is_target;
END;
$$;

-- 4) BEFORE INSERT guard on email_queue (global automatic dedupe)
CREATE OR REPLACE FUNCTION public.trg_dedupe_automatic_email_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    event_scope,
    event_type,
    event_version,
    source_event_key,
    template_key,
    first_email_queue_id
  ) VALUES (
    v_identity.event_scope,
    v_identity.event_type,
    v_identity.event_version,
    NEW.event_key,
    NEW.template_key,
    NEW.id
  )
  ON CONFLICT (event_scope, event_type, event_version) DO NOTHING
  RETURNING id INTO v_registered;

  IF v_registered IS NULL THEN
    -- Duplicate automatic lifecycle event -> drop insert
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_dedupe_automatic_email_queue ON public.email_queue;
CREATE TRIGGER tr_dedupe_automatic_email_queue
  BEFORE INSERT ON public.email_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_dedupe_automatic_email_queue();

-- 5) Remove duplicate order-submitted automatic path: keep dedicated order_confirmation trigger for INSERT,
-- and keep trigger_order_email for status transitions only.
CREATE OR REPLACE FUNCTION public.trigger_order_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_email TEXT;
  v_client_name TEXT;
  v_template_key TEXT;
  v_event_key TEXT;
BEGIN
  -- Only status transitions here (INSERT handled by trigger_order_confirmation_email)
  IF TG_OP <> 'UPDATE' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT email, COALESCE(full_name, 'Client')
  INTO v_client_email, v_client_name
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  IF v_client_email IS NULL THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'processing', 'processed' THEN
      v_template_key := 'order_processed';
      v_event_key := 'order_processed_' || NEW.id::TEXT;
    WHEN 'shipped' THEN
      v_template_key := 'order_shipped';
      v_event_key := 'order_shipped_' || NEW.id::TEXT;
    WHEN 'completed', 'completed_installation' THEN
      v_template_key := 'order_completed';
      v_event_key := 'order_completed_' || NEW.id::TEXT;
    WHEN 'cancelled' THEN
      v_template_key := 'order_cancelled';
      v_event_key := 'order_cancelled_' || NEW.id::TEXT;
    ELSE
      RETURN NEW;
  END CASE;

  PERFORM public.queue_email(
    v_event_key,
    v_client_email,
    v_template_key,
    jsonb_build_object(
      'client_name', v_client_name,
      'order_id', NEW.id,
      'order_number', COALESCE(NEW.order_number, NEW.confirmation_number),
      'service_type', NEW.service_type,
      'status', NEW.status,
      'total_amount', COALESCE(NEW.total_amount, 0)
    )
  );

  RETURN NEW;
END;
$$;