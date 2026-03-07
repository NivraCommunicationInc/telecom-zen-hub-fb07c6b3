-- Fix 1: Remove conflicting overloads and recreate ONE deterministic identity resolver
DROP FUNCTION IF EXISTS public.get_automatic_email_identity(text, text, jsonb, text, uuid);
DROP FUNCTION IF EXISTS public.get_automatic_email_identity(text, text, jsonb, text, text);

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

  -- Business lifecycle families ONLY (dedupe targets)
  IF v_template IN ('order_submitted', 'order_confirmation')
     OR v_event LIKE 'order_confirmation_%'
     OR v_event LIKE 'order_submitted_%'
  THEN
    event_type := 'order_confirmed';
    is_target := true;

  ELSIF v_template = 'order_completed'
     OR v_event LIKE 'order_completed_%'
  THEN
    event_type := 'order_completed';
    is_target := true;

  ELSIF v_template IN ('payment_confirmed', 'payment_received', 'payment_receipt')
     OR v_event LIKE 'payment_confirmed_%'
     OR v_event LIKE 'payment_received_%'
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

  -- Identity extraction
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
    nullif(v_vars->>'invoiceId', '')
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
    nullif(v_vars->>'appointmentId', '')
  );

  IF event_type IN ('order_confirmed', 'order_completed') THEN
    event_scope := coalesce('order:' || v_order_id, 'event:' || md5(v_event || '|' || v_template));
    event_version := coalesce(nullif(v_vars->>'status', ''), 'v1');

  ELSIF event_type = 'payment_confirmed' THEN
    event_scope := coalesce(
      CASE WHEN v_invoice_id IS NOT NULL THEN 'invoice:' || v_invoice_id END,
      CASE WHEN v_payment_id IS NOT NULL THEN 'payment:' || v_payment_id END,
      CASE WHEN v_order_id IS NOT NULL THEN 'order:' || v_order_id END,
      'event:' || md5(v_event || '|' || v_template)
    );

    event_version := coalesce(
      nullif(v_vars->>'invoice_number', ''),
      nullif(v_vars->>'payment_reference', ''),
      nullif(v_vars->>'reference', ''),
      nullif(v_invoice_id, ''),
      nullif(v_payment_id, ''),
      'v1'
    );

  ELSIF event_type = 'invoice_sent' THEN
    event_scope := coalesce(
      CASE WHEN v_invoice_id IS NOT NULL THEN 'invoice:' || v_invoice_id END,
      CASE WHEN v_order_id IS NOT NULL THEN 'order:' || v_order_id END,
      'event:' || md5(v_event || '|' || v_template)
    );

    event_version := coalesce(
      nullif(v_vars->>'invoice_number', ''),
      nullif(v_invoice_id, ''),
      'v1'
    );

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
      nullif(v_vars->>'status', ''),
      CASE WHEN event_type = 'appointment_confirmed' THEN 'confirmed' ELSE 'updated' END
    );

    event_version := v_sched || '|' || v_status;
  END IF;

  RETURN QUERY SELECT event_scope, event_type, event_version, is_manual, is_target;
END;
$$;

-- Fix 2: Recreate dedupe trigger function to use strict business-only targeting
CREATE OR REPLACE FUNCTION public.trg_dedupe_automatic_email_queue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_identity RECORD;
  v_registered uuid;
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;

  IF lower(coalesce(NEW.template_vars->>'manual_send', 'false')) IN ('1', 't', 'true', 'yes')
     OR lower(coalesce(NEW.event_key, '')) LIKE 'manual_%'
  THEN
    RETURN NEW;
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

-- Fix 3: channel_selections status usage aligned with constraint
-- Valid values: pending | confirmed | cancelled
CREATE OR REPLACE FUNCTION public.sync_channel_selection_from_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_is_tv boolean;
  v_status text;
BEGIN
  v_is_tv := (
    lower(COALESCE(NEW.service_type, '')) LIKE '%tv%'
    OR lower(COALESCE(NEW.service_type, '')) LIKE '%combo%'
    OR lower(COALESCE(NEW.service_type, '')) LIKE '%bundle%'
    OR lower(COALESCE(NEW.service_type, '')) LIKE '%giga%'
  );

  IF NOT v_is_tv THEN
    RETURN NEW;
  END IF;

  IF NEW.selected_channels IS NULL OR jsonb_typeof(NEW.selected_channels) <> 'array' THEN
    RETURN NEW;
  END IF;

  v_status := CASE
    WHEN NEW.status = 'cancelled' THEN 'cancelled'
    WHEN NEW.status IN ('activated', 'completed', 'installation_completed', 'delivered') THEN 'confirmed'
    WHEN COALESCE(NEW.channel_selection_locked, false) THEN 'confirmed'
    ELSE 'pending'
  END;

  INSERT INTO public.channel_selections (
    user_id,
    order_id,
    channels,
    total_price,
    status,
    confirmed_at,
    confirmed_by,
    updated_at
  ) VALUES (
    NEW.user_id,
    NEW.id,
    NEW.selected_channels,
    public.compute_channels_total(NEW.selected_channels),
    v_status,
    CASE WHEN v_status = 'confirmed' THEN now() ELSE NULL END,
    CASE WHEN v_status = 'confirmed' THEN COALESCE(NEW.channel_assigned_by, 'system') ELSE NULL END,
    now()
  )
  ON CONFLICT (order_id)
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    channels = EXCLUDED.channels,
    total_price = EXCLUDED.total_price,
    status = CASE
      WHEN NEW.status = 'cancelled' THEN 'cancelled'
      WHEN channel_selections.status = 'cancelled' AND NEW.status <> 'cancelled' THEN 'pending'
      WHEN channel_selections.status = 'confirmed' AND EXCLUDED.status = 'pending' THEN 'confirmed'
      ELSE EXCLUDED.status
    END,
    confirmed_at = CASE
      WHEN NEW.status = 'cancelled' THEN channel_selections.confirmed_at
      WHEN EXCLUDED.status = 'confirmed' THEN COALESCE(channel_selections.confirmed_at, now())
      ELSE channel_selections.confirmed_at
    END,
    confirmed_by = CASE
      WHEN NEW.status = 'cancelled' THEN channel_selections.confirmed_by
      WHEN EXCLUDED.status = 'confirmed' THEN COALESCE(EXCLUDED.confirmed_by, channel_selections.confirmed_by, 'system')
      ELSE channel_selections.confirmed_by
    END,
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_channel_selection_activation_from_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_is_tv boolean;
BEGIN
  v_is_tv := (
    lower(COALESCE(NEW.service_type, '')) LIKE '%tv%'
    OR lower(COALESCE(NEW.service_type, '')) LIKE '%combo%'
    OR lower(COALESCE(NEW.service_type, '')) LIKE '%bundle%'
    OR lower(COALESCE(NEW.service_type, '')) LIKE '%giga%'
  );

  IF NOT v_is_tv THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('activated', 'completed', 'installation_completed', 'delivered') THEN
    UPDATE public.channel_selections
    SET
      status = 'confirmed',
      confirmed_at = COALESCE(confirmed_at, now()),
      confirmed_by = COALESCE(confirmed_by, NEW.channel_assigned_by, 'system'),
      updated_at = now()
    WHERE order_id = NEW.id;

  ELSIF NEW.status = 'cancelled' THEN
    UPDATE public.channel_selections
    SET
      status = 'cancelled',
      updated_at = now()
    WHERE order_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;