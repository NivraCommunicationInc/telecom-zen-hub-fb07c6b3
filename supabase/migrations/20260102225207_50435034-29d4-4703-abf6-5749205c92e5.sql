-- Feature 1: Add related order fields to support_tickets
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS related_order_id UUID REFERENCES public.orders(id);
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS related_order_reference TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS issue_type TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_support_tickets_related_order ON public.support_tickets(related_order_id);

-- Feature 2: Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_role TEXT NOT NULL DEFAULT 'client',
  type TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  message TEXT,
  link_target TEXT,
  link_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for notifications
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON public.notifications(created_at DESC);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all notifications"
  ON public.notifications FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to create a notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_user_role TEXT,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT DEFAULT NULL,
  p_link_target TEXT DEFAULT NULL,
  p_link_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, user_role, type, title, message, link_target, link_id)
  VALUES (p_user_id, p_user_role, p_type, p_title, p_message, p_link_target, p_link_id)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Trigger function to notify on new invoice
CREATE OR REPLACE FUNCTION public.notify_on_new_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Notify client
  PERFORM public.create_notification(
    NEW.user_id,
    'client',
    'invoice',
    'Nouvelle facture disponible',
    'Facture #' || COALESCE(NEW.invoice_number, NEW.id::TEXT) || ' - ' || NEW.amount || '$',
    '/client/invoices',
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_new_invoice
  AFTER INSERT ON public.billing
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_invoice();

-- Trigger function to notify on order status change
CREATE OR REPLACE FUNCTION public.notify_on_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('shipped', 'completed', 'completed_installation') THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'client',
      'order',
      CASE 
        WHEN NEW.status = 'shipped' THEN 'Commande expédiée'
        WHEN NEW.status = 'completed' THEN 'Commande terminée'
        WHEN NEW.status = 'completed_installation' THEN 'Installation terminée'
        ELSE 'Mise à jour commande'
      END,
      'Commande #' || COALESCE(NEW.order_number, NEW.id::TEXT),
      '/client/orders',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_order_status
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_order_status_change();

-- Trigger function to notify on new ticket reply from staff
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
  
  -- Only notify client if reply is from staff
  IF NEW.author_role IN ('admin', 'employee', 'technician') AND ticket_user_id IS NOT NULL THEN
    PERFORM public.create_notification(
      ticket_user_id,
      'client',
      'ticket',
      'Nouvelle réponse à votre ticket',
      'Ticket #' || COALESCE(ticket_number, NEW.ticket_id::TEXT),
      '/client/tickets',
      NEW.ticket_id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_ticket_reply
  AFTER INSERT ON public.ticket_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_ticket_reply();

-- Trigger function to notify on appointment changes
CREATE OR REPLACE FUNCTION public.notify_on_appointment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    PERFORM public.create_notification(
      NEW.client_id,
      'client',
      'appointment',
      CASE 
        WHEN TG_OP = 'INSERT' THEN 'Nouveau rendez-vous confirmé'
        WHEN NEW.status = 'cancelled' THEN 'Rendez-vous annulé'
        ELSE 'Mise à jour de rendez-vous'
      END,
      NEW.title || ' - ' || to_char(NEW.scheduled_at, 'DD Mon YYYY HH24:MI'),
      '/client/appointments',
      NEW.id
    );
  END IF;
  
  -- Notify technician if assigned
  IF NEW.technician_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.technician_id IS DISTINCT FROM NEW.technician_id) THEN
    DECLARE
      tech_user_id UUID;
    BEGIN
      SELECT user_id INTO tech_user_id FROM public.technicians WHERE id = NEW.technician_id;
      IF tech_user_id IS NOT NULL THEN
        PERFORM public.create_notification(
          tech_user_id,
          'technician',
          'appointment',
          'Nouveau rendez-vous assigné',
          NEW.title || ' - ' || to_char(NEW.scheduled_at, 'DD Mon YYYY HH24:MI'),
          '/technician',
          NEW.id
        );
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_appointment
  AFTER INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_appointment_change();