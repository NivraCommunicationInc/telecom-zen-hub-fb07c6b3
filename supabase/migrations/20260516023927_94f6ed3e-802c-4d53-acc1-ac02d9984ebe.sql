CREATE OR REPLACE FUNCTION public.fn_notify_commission_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_number text;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    SELECT o.order_number INTO v_order_number
    FROM public.orders o
    WHERE o.id = NEW.order_id;

    INSERT INTO public.employee_notifications (
      user_id,
      notification_type,
      title,
      message,
      is_read
    )
    VALUES (
      NEW.agent_id,
      'system',
      'Commission approuvée — ' || NEW.amount::text || ' $',
      'Votre commission de ' || NEW.amount::text || ' $ a été approuvée.',
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
        'order_number', COALESCE(v_order_number, ''),
        'status', 'Approuvée'
      ),
      'queued'
    FROM public.profiles p
    WHERE p.user_id = NEW.agent_id
    ON CONFLICT (event_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;