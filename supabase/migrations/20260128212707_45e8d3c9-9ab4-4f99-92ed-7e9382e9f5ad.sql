-- Fix search_path security for notify_new_order
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.staff_notifications (
    notification_type,
    title,
    message,
    entity_type,
    entity_id,
    entity_number,
    client_id,
    client_name,
    client_email,
    amount
  ) VALUES (
    'new_order',
    'Nouvelle commande',
    'Commande ' || COALESCE(NEW.order_number, 'N/A') || ' reçue de ' || COALESCE(NEW.client_first_name, '') || ' ' || COALESCE(NEW.client_last_name, ''),
    'order',
    NEW.id,
    NEW.order_number,
    NEW.user_id,
    COALESCE(NEW.client_first_name, '') || ' ' || COALESCE(NEW.client_last_name, ''),
    NEW.client_email,
    NEW.total_amount
  );
  RETURN NEW;
END;
$$;