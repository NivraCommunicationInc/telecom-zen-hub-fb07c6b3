-- Fix appointment notification/email gating: no confirmation behavior during hold phase

CREATE OR REPLACE FUNCTION public.trigger_appointment_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client_email TEXT;
  v_client_name TEXT;
  v_template_key TEXT;
  v_event_key TEXT;
  v_order_number TEXT;
BEGIN
  -- Never email for temporary holds or unlinked appointments
  IF NEW.status = 'hold' OR NEW.order_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Require an order confirmation identifier before any appointment email
  SELECT COALESCE(NULLIF(o.confirmation_number, ''), o.order_number::text)
  INTO v_order_number
  FROM public.orders o
  WHERE o.id = NEW.order_id;

  IF v_order_number IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get client info
  IF NEW.client_id IS NOT NULL THEN
    SELECT email, COALESCE(full_name, 'Client') INTO v_client_email, v_client_name
    FROM public.profiles
    WHERE user_id = NEW.client_id;
  END IF;

  IF v_client_email IS NULL THEN
    v_client_email := NEW.client_email;
  END IF;

  IF v_client_email IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Only confirmed inserts can send confirmation email
    IF NEW.status = 'confirmed' THEN
      v_template_key := 'appointment_scheduled';
      v_event_key := 'appointment_scheduled_' || NEW.id::TEXT || '_' || v_order_number;
    ELSE
      RETURN NEW;
    END IF;
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Hold -> confirmed: send confirmation only now (post-order linkage)
    IF OLD.status = 'hold' AND NEW.status = 'confirmed' THEN
      v_template_key := 'appointment_scheduled';
      v_event_key := 'appointment_scheduled_' || NEW.id::TEXT || '_' || v_order_number;
    ELSIF NEW.status = 'cancelled' THEN
      v_template_key := 'appointment_cancelled';
      v_event_key := 'appointment_cancelled_' || NEW.id::TEXT || '_' || v_order_number;
    ELSE
      v_template_key := 'appointment_updated';
      v_event_key := 'appointment_updated_' || NEW.id::TEXT || '_' || NEW.status || '_' || v_order_number;
    END IF;
  ELSIF OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at THEN
    v_template_key := 'appointment_updated';
    v_event_key := 'appointment_rescheduled_' || NEW.id::TEXT || '_' || v_order_number;
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.queue_email(
    v_event_key,
    v_client_email,
    v_template_key,
    jsonb_build_object(
      'client_name', COALESCE(v_client_name, 'Client'),
      'appointment_id', NEW.id,
      'appointment_number', NEW.appointment_number,
      'order_number', v_order_number,
      'title', NEW.title,
      'scheduled_at', NEW.scheduled_at,
      'status', NEW.status,
      'service_address', NEW.service_address
    )
  );

  RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public.notify_on_appointment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- HOLD is a temporary checkout reservation: no client "confirmed" notification
  IF NEW.status = 'hold' THEN
    RETURN NEW;
  END IF;

  -- Ignore hold replacement churn
  IF TG_OP = 'UPDATE' AND OLD.status = 'hold' AND NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  IF NEW.client_id IS NOT NULL THEN
    PERFORM public.create_notification(
      NEW.client_id,
      'client',
      'appointment',
      CASE
        WHEN TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN 'Nouveau rendez-vous confirmé'
        WHEN TG_OP = 'INSERT' THEN 'Nouveau rendez-vous planifié'
        WHEN NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM NEW.status THEN 'Rendez-vous confirmé'
        WHEN NEW.status = 'cancelled' THEN 'Rendez-vous annulé'
        ELSE 'Mise à jour de rendez-vous'
      END,
      NEW.title || ' - ' || to_char(NEW.scheduled_at, 'DD Mon YYYY HH24:MI'),
      '/client/appointments',
      NEW.id
    );
  END IF;

  -- Notify technician if assigned
  IF NEW.technician_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.technician_id IS DISTINCT FROM NEW.technician_id) THEN
    DECLARE
      tech_user_id UUID;
    BEGIN
      SELECT user_id INTO tech_user_id FROM public.technicians WHERE id = NEW.technician_id;
      IF tech_user_id IS NOT NULL THEN
        PERFORM public.create_notification(
          tech_user_id,
          'technician',
          'appointment',
          'Nouveau rendez-vous assigné',
          NEW.title || ' - ' || to_char(NEW.scheduled_at, 'DD Mon YYYY HH24:MI'),
          '/technician',
          NEW.id
        );
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$function$;