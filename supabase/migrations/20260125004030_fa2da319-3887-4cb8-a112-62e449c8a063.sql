-- SEV0 HOTFIX: Fix trigger functions that cause ticket reply failures

-- 1) Fix trigger_ticket_reply_email - use correct email_queue schema
CREATE OR REPLACE FUNCTION public.trigger_ticket_reply_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client_email TEXT;
  v_client_name TEXT;
  v_ticket_number TEXT;
  v_ticket_subject TEXT;
  v_event_key TEXT;
BEGIN
  -- Only send email for admin/staff replies to clients
  IF NEW.is_admin = true OR NEW.sender_role IN ('admin', 'employee', 'technician') THEN
    -- Get ticket info
    SELECT ticket_number, subject, client_email INTO v_ticket_number, v_ticket_subject, v_client_email
    FROM public.support_tickets
    WHERE id = NEW.ticket_id;
    
    -- Get client name from profile
    SELECT COALESCE(full_name, 'Client') INTO v_client_name
    FROM public.profiles
    WHERE user_id = (SELECT user_id FROM public.support_tickets WHERE id = NEW.ticket_id);
    
    IF v_client_email IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Build idempotent event key
    v_event_key := 'ticket_reply_' || NEW.id::TEXT;
    
    -- Queue email using correct schema
    PERFORM public.queue_email(
      v_event_key,
      v_client_email,
      'ticket_reply',
      jsonb_build_object(
        'client_name', COALESCE(v_client_name, 'Client'),
        'ticket_id', NEW.ticket_id,
        'ticket_number', v_ticket_number,
        'subject', v_ticket_subject,
        'reply_content', LEFT(NEW.content, 500),
        'reply_date', NEW.created_at
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2) Fix notify_on_ticket_reply - use correct notification schema
CREATE OR REPLACE FUNCTION public.notify_on_ticket_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket_owner_id UUID;
  v_ticket_number TEXT;
  v_is_admin_reply BOOLEAN;
BEGIN
  -- Get ticket details
  SELECT owner_user_id, ticket_number INTO v_ticket_owner_id, v_ticket_number
  FROM public.support_tickets
  WHERE id = NEW.ticket_id;
  
  v_is_admin_reply := (NEW.is_admin = true OR NEW.sender_role IN ('admin', 'employee', 'technician'));
  
  -- Only notify client if it's an admin/staff reply
  IF v_is_admin_reply AND v_ticket_owner_id IS NOT NULL THEN
    PERFORM public.create_notification(
      v_ticket_owner_id,
      'client',
      'ticket',
      'Nouvelle réponse sur votre ticket',
      'Ticket #' || COALESCE(v_ticket_number, NEW.ticket_id::TEXT),
      '/portal/tickets',
      NEW.ticket_id
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 3) Ensure triggers use the fixed functions
DROP TRIGGER IF EXISTS trigger_ticket_reply_email ON public.ticket_replies;
CREATE TRIGGER trigger_ticket_reply_email
  AFTER INSERT ON public.ticket_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_ticket_reply_email();

DROP TRIGGER IF EXISTS notify_on_ticket_reply ON public.ticket_replies;
CREATE TRIGGER notify_on_ticket_reply
  AFTER INSERT ON public.ticket_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_ticket_reply();

-- 4) Add RLS policy for admin/staff to insert replies with sender_role
DROP POLICY IF EXISTS "Authenticated users can insert replies" ON public.ticket_replies;
CREATE POLICY "Authenticated users can insert replies"
  ON public.ticket_replies
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 5) Ensure support_tickets allows nullable id_verification_status
-- (No change needed - it's already nullable, but ensure default)
ALTER TABLE public.support_tickets
  ALTER COLUMN id_verification_status DROP NOT NULL;

-- 6) Fix user_roles RLS for influencer self-registration
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;
CREATE POLICY "Users can insert own role"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage all roles" ON public.user_roles;
CREATE POLICY "Service role can manage all roles"
  ON public.user_roles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);