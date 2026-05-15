CREATE OR REPLACE FUNCTION public.fn_notify_commission_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.employee_notifications (user_id, type, title, message, reference_id, is_read)
    VALUES (
      NEW.agent_id,
      'system',
      'Commission approuvée — ' || NEW.amount::text || ' $',
      'Votre commission de ' || NEW.amount::text || ' $ a été approuvée.',
      NEW.order_id,
      false
    );

    INSERT INTO public.email_queue (event_key, to_email, template_key, template_vars, status)
    SELECT
      'commission_approved_' || NEW.id,
      p.email,
      'commission_approved',
      jsonb_build_object(
        'agent_name', p.full_name,
        'amount', NEW.amount,
        'order_id', NEW.order_id,
        'status', 'Approuvée'
      ),
      'queued'
    FROM public.profiles p
    WHERE p.user_id = NEW.agent_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_field_commission_approved ON public.field_commissions;

CREATE TRIGGER trg_field_commission_approved
AFTER UPDATE ON public.field_commissions
FOR EACH ROW
EXECUTE FUNCTION public.fn_notify_commission_approved();