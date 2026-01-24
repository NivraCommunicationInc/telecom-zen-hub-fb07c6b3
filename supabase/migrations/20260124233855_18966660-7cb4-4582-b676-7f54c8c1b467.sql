-- HOTFIX: Remove author_role references from functions that might crash

-- Drop and recreate notify_on_ticket_reply without author_role
CREATE OR REPLACE FUNCTION public.notify_on_ticket_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use sender_role (the correct column) instead of author_role
  INSERT INTO public.admin_notification_logs (
    event_type,
    event_id,
    client_email,
    priority,
    sent_to
  ) VALUES (
    'ticket_reply',
    NEW.ticket_id::text,
    NEW.sender_email,
    CASE WHEN NEW.sender_role = 'client' THEN 'normal' ELSE 'low' END,
    'admin'
  );
  RETURN NEW;
END;
$$;

-- Drop and recreate trigger_ticket_reply_email without author_role
CREATE OR REPLACE FUNCTION public.trigger_ticket_reply_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket RECORD;
  v_recipient_email TEXT;
BEGIN
  -- Get ticket info
  SELECT * INTO v_ticket FROM public.tickets WHERE id = NEW.ticket_id;
  
  -- Determine recipient based on sender_role (not author_role)
  IF NEW.sender_role = 'client' THEN
    -- Client replied, notify admin
    v_recipient_email := 'support@nivratelecom.ca';
  ELSE
    -- Staff replied, notify client
    v_recipient_email := v_ticket.client_email;
  END IF;
  
  -- Queue the email
  INSERT INTO public.email_queue (
    recipient_email,
    recipient_name,
    template_key,
    template_vars,
    status
  ) VALUES (
    v_recipient_email,
    COALESCE(v_ticket.client_name, 'Client'),
    'ticket_reply_notification',
    jsonb_build_object(
      'ticket_number', v_ticket.ticket_number,
      'ticket_subject', v_ticket.subject,
      'reply_preview', LEFT(NEW.content, 200),
      'sender_role', NEW.sender_role
    ),
    'queued'
  );
  
  RETURN NEW;
END;
$$;