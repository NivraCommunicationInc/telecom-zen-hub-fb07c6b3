-- ============================================================================
-- SEV0 FIX: Create VIEW public.tickets as alias for support_tickets
-- AND fix trigger functions referencing public.tickets
-- ============================================================================

-- 1. Create VIEW alias for legacy compatibility
DROP VIEW IF EXISTS public.tickets CASCADE;

CREATE VIEW public.tickets AS 
SELECT * FROM public.support_tickets;

-- Grant proper permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT SELECT ON public.tickets TO anon;

-- 2. Fix the notify_on_ticket_reply function to use support_tickets
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
  -- Get ticket info from support_tickets (not tickets view)
  SELECT user_id, ticket_number INTO ticket_user_id, ticket_number
  FROM public.support_tickets WHERE id = NEW.ticket_id;
  
  -- Only notify client if reply is from staff
  IF NEW.sender_role IN ('admin', 'employee', 'technician') AND ticket_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, link, read)
    VALUES (
      ticket_user_id,
      'Nouvelle réponse à votre ticket',
      'Un agent a répondu à votre ticket #' || COALESCE(ticket_number, 'N/A'),
      'ticket_reply',
      '/portal/tickets?id=' || NEW.ticket_id,
      false
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Fix trigger_ticket_reply_email function to use support_tickets
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
  -- Get ticket info from support_tickets (not tickets view)
  SELECT * INTO v_ticket FROM public.support_tickets WHERE id = NEW.ticket_id;
  
  -- Determine recipient based on sender_role
  IF NEW.sender_role = 'client' THEN
    -- Client replied, notify admin
    v_recipient_email := 'support@nivratelecom.ca';
  ELSE
    -- Staff replied, notify client
    v_recipient_email := v_ticket.client_email;
  END IF;
  
  -- Queue email notification
  IF v_recipient_email IS NOT NULL THEN
    INSERT INTO public.email_queue (
      recipient_email,
      recipient_name,
      template_type,
      template_data,
      status,
      priority
    ) VALUES (
      v_recipient_email,
      COALESCE(v_ticket.client_name, 'Client'),
      'ticket_reply',
      jsonb_build_object(
        'ticket_number', v_ticket.ticket_number,
        'subject', v_ticket.subject,
        'reply_content', LEFT(NEW.content, 200),
        'sender_role', NEW.sender_role
      ),
      'queued',
      'normal'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Ensure RLS policies allow proper access for ticket creation
-- Admin/Employee/Technician can INSERT support_tickets for any user
DROP POLICY IF EXISTS "Staff can create tickets for clients" ON public.support_tickets;
CREATE POLICY "Staff can create tickets for clients"
ON public.support_tickets
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role) OR
  has_role(auth.uid(), 'technician'::app_role)
);

-- Client can INSERT only for their own user_id
DROP POLICY IF EXISTS "Clients can create own tickets" ON public.support_tickets;
CREATE POLICY "Clients can create own tickets"
ON public.support_tickets
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id = auth.uid() OR user_id = auth.uid()
);