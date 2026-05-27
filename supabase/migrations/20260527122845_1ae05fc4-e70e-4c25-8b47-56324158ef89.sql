
-- Backstop notification triggers: guarantee client emails for Core/OneView actions
-- regardless of which code path performs the write.

CREATE OR REPLACE FUNCTION public.enqueue_account_adjustment_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_email text;
  v_first_name text;
  v_template text;
  v_amount text;
BEGIN
  SELECT a.client_id INTO v_client_id FROM public.accounts a WHERE a.id = NEW.account_id;
  IF v_client_id IS NULL THEN RETURN NEW; END IF;
  SELECT p.email, p.first_name INTO v_email, v_first_name FROM public.profiles p WHERE p.id = v_client_id;
  IF v_email IS NULL OR v_email = '' THEN RETURN NEW; END IF;

  v_template := CASE
    WHEN NEW.type IN ('credit','first_month_free') THEN 'client_credit_added'
    WHEN NEW.type IN ('fee','one_time') THEN 'client_charge_added'
    ELSE NULL
  END;
  IF v_template IS NULL THEN RETURN NEW; END IF;

  v_amount := to_char(NEW.amount, 'FM999G999G990D00') || ' $';

  INSERT INTO public.email_queue (to_email, template_key, template_vars, status, priority)
  VALUES (
    v_email,
    v_template,
    jsonb_build_object(
      'first_name', coalesce(v_first_name, 'Client'),
      'amount', v_amount,
      'description', coalesce(NEW.description, ''),
      'months_total', NEW.months_total::text,
      'is_permanent', NEW.is_permanent::text,
      'reason', coalesce(NEW.description, '—'),
      'to_email', v_email
    ),
    'queued',
    0
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_account_adjustment_email ON public.account_adjustments;
CREATE TRIGGER trg_enqueue_account_adjustment_email
AFTER INSERT ON public.account_adjustments
FOR EACH ROW
WHEN (NEW.status = 'active')
EXECUTE FUNCTION public.enqueue_account_adjustment_email();


CREATE OR REPLACE FUNCTION public.enqueue_appointment_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_first_name text;
  v_template text;
  v_subject_title text;
BEGIN
  v_email := NULLIF(NEW.client_email, '');
  IF v_email IS NULL AND NEW.client_id IS NOT NULL THEN
    SELECT p.email, p.first_name INTO v_email, v_first_name FROM public.profiles p WHERE p.id = NEW.client_id;
  ELSIF NEW.client_id IS NOT NULL THEN
    SELECT p.first_name INTO v_first_name FROM public.profiles p WHERE p.id = NEW.client_id;
  END IF;
  IF v_email IS NULL OR v_email = '' THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    v_template := 'client_appointment_scheduled';
    v_subject_title := coalesce(NEW.title, 'Votre rendez-vous');
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'cancelled' THEN
      v_template := 'appointment_updated';
      v_subject_title := 'Rendez-vous annulé';
    ELSIF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
      v_template := 'appointment_updated';
      v_subject_title := 'Rendez-vous modifié';
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.email_queue (to_email, template_key, template_vars, status, priority)
  VALUES (
    v_email,
    v_template,
    jsonb_build_object(
      'first_name', coalesce(v_first_name, 'Client'),
      'title', v_subject_title,
      'appointment_number', coalesce(NEW.appointment_number, '—'),
      'scheduled_at', to_char(NEW.scheduled_at AT TIME ZONE 'America/Toronto', 'DD/MM/YYYY HH24:MI'),
      'service_type', coalesce(NEW.service_type, '—'),
      'service_address', coalesce(
        nullif(concat_ws(', ', NEW.service_address, NEW.service_city, NEW.service_postal_code), ''),
        '—'
      ),
      'status', coalesce(NEW.status, '—'),
      'to_email', v_email
    ),
    'queued',
    0
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_appointment_email_ins ON public.appointments;
CREATE TRIGGER trg_enqueue_appointment_email_ins
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_appointment_email();

DROP TRIGGER IF EXISTS trg_enqueue_appointment_email_upd ON public.appointments;
CREATE TRIGGER trg_enqueue_appointment_email_upd
AFTER UPDATE OF scheduled_at, status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_appointment_email();
