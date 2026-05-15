CREATE OR REPLACE FUNCTION public.notify_commission_approved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  agent_email TEXT;
  agent_name TEXT;
  order_no TEXT;
  ord_id UUID;
BEGIN
  IF (TG_OP = 'UPDATE'
      AND NEW.status = 'approved'
      AND COALESCE(OLD.status, '') <> 'approved') THEN

    SELECT email, COALESCE(full_name, email)
      INTO agent_email, agent_name
      FROM public.profiles WHERE user_id = NEW.agent_id LIMIT 1;

    ord_id := NEW.order_id;
    IF ord_id IS NOT NULL THEN
      SELECT COALESCE(o.order_number, '#' || substring(ord_id::text, 1, 8))
        INTO order_no FROM public.orders o WHERE o.id = ord_id LIMIT 1;
    END IF;
    IF order_no IS NULL THEN
      order_no := 'N/A';
    END IF;

    INSERT INTO public.employee_notifications (user_id, notification_type, title, message, link_url)
    VALUES (
      NEW.agent_id,
      'system',
      'Commission approuvée',
      'Votre commission de ' || to_char(NEW.amount, 'FM999G990D00') || ' $ pour la commande ' || order_no || ' a été approuvée.',
      '/field/commissions'
    );

    IF agent_email IS NOT NULL THEN
      INSERT INTO public.email_queue (template_key, to_email, template_vars, status)
      VALUES (
        'commission_approved',
        agent_email,
        jsonb_build_object(
          'agent_name', agent_name,
          'order_number', order_no,
          'amount', NEW.amount,
          'status_label', 'Approuvée'
        ),
        'queued'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;