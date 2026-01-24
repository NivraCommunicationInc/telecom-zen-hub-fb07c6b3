-- ============================================================================
-- FIX: Update trigger functions to use sender_role instead of author_role
-- The ticket_replies table has sender_role, but triggers reference author_role
-- ============================================================================

-- 1. Fix notify_on_ticket_reply function
CREATE OR REPLACE FUNCTION public.notify_on_ticket_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ticket_user_id UUID;
  ticket_number TEXT;
BEGIN
  -- Get ticket info
  SELECT user_id, ticket_number INTO ticket_user_id, ticket_number
  FROM public.support_tickets WHERE id = NEW.ticket_id;
  
  -- Only notify client if reply is from staff (using sender_role instead of author_role)
  IF NEW.sender_role IN ('admin', 'employee', 'technician') AND ticket_user_id IS NOT NULL THEN
    PERFORM public.create_notification(
      ticket_user_id,
      'client',
      'ticket',
      'Nouvelle réponse à votre ticket',
      'Ticket #' || COALESCE(ticket_number, NEW.ticket_id::TEXT),
      '/portal/tickets',
      NEW.ticket_id
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Fix trigger_ticket_reply_email function
CREATE OR REPLACE FUNCTION public.trigger_ticket_reply_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_user_id UUID;
  v_client_email TEXT;
  v_client_name TEXT;
  v_ticket_number TEXT;
BEGIN
  -- Only notify client if reply is from staff (using sender_role instead of author_role)
  IF NEW.sender_role IS NULL OR NEW.sender_role NOT IN ('admin', 'employee', 'technician') THEN
    RETURN NEW;
  END IF;
  
  -- Get ticket info
  SELECT user_id, ticket_number INTO v_ticket_user_id, v_ticket_number
  FROM public.support_tickets WHERE id = NEW.ticket_id;
  
  IF v_ticket_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get client info
  SELECT email, COALESCE(full_name, 'Client') INTO v_client_email, v_client_name
  FROM public.profiles WHERE user_id = v_ticket_user_id;
  
  IF v_client_email IS NULL THEN
    RETURN NEW;
  END IF;
  
  PERFORM public.queue_email(
    'ticket_reply_' || NEW.id::TEXT,
    v_client_email,
    'ticket_reply',
    jsonb_build_object(
      'client_name', v_client_name,
      'ticket_id', NEW.ticket_id,
      'ticket_number', v_ticket_number,
      'reply_preview', LEFT(NEW.content, 200)
    )
  );
  
  RETURN NEW;
END;
$$;