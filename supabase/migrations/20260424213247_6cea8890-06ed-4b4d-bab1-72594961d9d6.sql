-- Auto-notify employees when a commission row is created.
-- Idempotent via event_key uniqueness; non-blocking via EXCEPTION WHEN OTHERS.

CREATE OR REPLACE FUNCTION public.fn_notify_commission_generated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_full_name text;
  v_amount numeric;
  v_event_key text;
BEGIN
  -- Resolve agent user_id depending on table
  IF TG_TABLE_NAME = 'sales_commissions' THEN
    v_user_id := NEW.salesperson_id;
    v_amount := COALESCE(NEW.commission_amount, 0);
  ELSIF TG_TABLE_NAME = 'field_commissions' THEN
    v_user_id := NEW.agent_id;
    v_amount := COALESCE(NEW.amount, 0);
  ELSE
    RETURN NEW;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT email,
         COALESCE(full_name, NULLIF(TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')), ''), 'Collègue')
    INTO v_email, v_full_name
    FROM public.profiles
   WHERE user_id = v_user_id
   LIMIT 1;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN NEW;
  END IF;

  v_event_key := 'hr_commission_generated_' || NEW.id::text;

  BEGIN
    INSERT INTO public.email_queue (
      event_key, to_email, template_key, template_vars,
      message_type, entity_type, entity_id, status
    ) VALUES (
      v_event_key,
      v_email,
      'hr_commission_generated',
      jsonb_build_object(
        'client_name', v_full_name,
        'amount', v_amount,
        'generated_at', now(),
        'portal_url', 'https://nivra-telecom.ca/rh'
      ),
      'hr_commission_generated',
      'commission',
      NEW.id::text,
      'queued'
    );
  EXCEPTION
    WHEN unique_violation THEN NULL;  -- already enqueued
    WHEN OTHERS THEN
      RAISE WARNING '[notify_commission_generated] enqueue failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_commission_generated_sales ON public.sales_commissions;
CREATE TRIGGER trg_notify_commission_generated_sales
  AFTER INSERT ON public.sales_commissions
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_commission_generated();

DROP TRIGGER IF EXISTS trg_notify_commission_generated_field ON public.field_commissions;
CREATE TRIGGER trg_notify_commission_generated_field
  AFTER INSERT ON public.field_commissions
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_commission_generated();