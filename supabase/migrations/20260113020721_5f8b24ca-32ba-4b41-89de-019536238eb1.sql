-- Fix order submission failure: ensure support_tickets.owner_user_id is always set

-- 1) Safety net: auto-fill owner_user_id on ANY ticket insert
CREATE OR REPLACE FUNCTION public.support_tickets_set_owner_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_user_id IS NULL THEN
    NEW.owner_user_id := NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_tickets_set_owner_user_id ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_set_owner_user_id
BEFORE INSERT ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.support_tickets_set_owner_user_id();

-- 2) Fix the specific trigger that creates the first-order ID verification ticket
CREATE OR REPLACE FUNCTION public.create_id_verification_ticket_for_new_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_new_client boolean;
  new_ticket_id uuid;
  client_email_val text;
BEGIN
  -- Only trigger on new orders
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Check if this is the client's first order
  is_new_client := public.is_first_client_order(NEW.user_id, NEW.id);

  -- If not a new client, skip
  IF NOT is_new_client THEN
    RETURN NEW;
  END IF;

  -- Get client email from profile or order
  SELECT COALESCE(p.email, NEW.client_email) INTO client_email_val
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;

  IF client_email_val IS NULL THEN
    client_email_val := NEW.client_email;
  END IF;

  -- Create the ID verification ticket
  INSERT INTO public.support_tickets (
    user_id,
    owner_user_id,
    client_email,
    subject,
    description,
    status,
    priority,
    category,
    requires_id_upload,
    id_verification_status,
    related_order_id,
    related_order_reference,
    issue_type,
    created_by_user_id,
    created_by_role
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    client_email_val,
    'Validation d''identité requise - Commande ' || COALESCE(NEW.order_number, NEW.confirmation_number, NEW.id::text),
    'Veuillez téléverser une pièce d''identité valide (permis de conduire, passeport ou carte d''identité) pour valider votre commande. Cette vérification est requise pour tous les nouveaux clients et protège votre compte.',
    'open',
    'high',
    'id_verification',
    true,
    'pending',
    NEW.id,
    COALESCE(NEW.order_number, NEW.confirmation_number),
    'ID_VERIFICATION',
    NEW.user_id,
    'system'
  )
  RETURNING id INTO new_ticket_id;

  -- Update the order status to indicate ID verification hold
  UPDATE public.orders
  SET status = 'verification',
      id_verification_status = 'pending'
  WHERE id = NEW.id;

  -- Create a notification for the client
  PERFORM public.create_notification(
    NEW.user_id,
    'client',
    'ticket',
    'Validation d''identité requise',
    'Veuillez téléverser une pièce d''identité pour valider votre commande.',
    '/portal/tickets',
    new_ticket_id
  );

  RETURN NEW;
END;
$function$;