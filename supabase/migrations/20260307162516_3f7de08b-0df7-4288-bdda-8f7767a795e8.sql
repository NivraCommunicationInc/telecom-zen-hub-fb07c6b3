
-- Fix: Do NOT send appointment emails when appointment status is 'hold'
-- Emails should only be sent when the appointment is confirmed (after order completion)

CREATE OR REPLACE FUNCTION public.trigger_appointment_email()
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
  -- SKIP email for holds — these are temporary reservations during checkout
  -- Email will be sent when the hold is confirmed (status changes from 'hold' to 'confirmed')
  IF NEW.status = 'hold' THEN
    RETURN NEW;
  END IF;

  -- Get client info
  IF NEW.client_id IS NOT NULL THEN
    SELECT email, COALESCE(full_name, 'Client') INTO v_client_email, v_client_name
    FROM public.profiles WHERE user_id = NEW.client_id;
  END IF;
  
  IF v_client_email IS NULL THEN
    v_client_email := NEW.client_email;
  END IF;
  
  IF v_client_email IS NULL THEN
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'INSERT' THEN
    -- Only send scheduled email for non-hold inserts
    v_template_key := 'appointment_scheduled';
    v_event_key := 'appointment_scheduled_' || NEW.id::TEXT;
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    -- When transitioning FROM hold TO confirmed, send the scheduled email
    IF OLD.status = 'hold' AND NEW.status = 'confirmed' THEN
      v_template_key := 'appointment_scheduled';
      v_event_key := 'appointment_scheduled_' || NEW.id::TEXT;
    ELSIF NEW.status = 'cancelled' THEN
      v_template_key := 'appointment_cancelled';
      v_event_key := 'appointment_cancelled_' || NEW.id::TEXT;
    ELSE
      v_template_key := 'appointment_updated';
      v_event_key := 'appointment_updated_' || NEW.id::TEXT || '_' || NEW.status;
    END IF;
  ELSIF OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at THEN
    v_template_key := 'appointment_updated';
    v_event_key := 'appointment_rescheduled_' || NEW.id::TEXT;
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
      'title', NEW.title,
      'scheduled_at', NEW.scheduled_at,
      'status', NEW.status,
      'service_address', NEW.service_address
    )
  );
  
  RETURN NEW;
END;
$$;
