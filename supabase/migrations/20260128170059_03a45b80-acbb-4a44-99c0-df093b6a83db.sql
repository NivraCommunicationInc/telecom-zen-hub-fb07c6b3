-- =============================================
-- STAFF NOTIFICATIONS SYSTEM
-- Real-time notifications for Admin & Employee portals
-- =============================================

-- Notification types enum
CREATE TYPE public.staff_notification_type AS ENUM (
  'new_order',
  'invoice_created',
  'payment_received',
  'service_suspended',
  'service_cancelled'
);

-- Main notifications table
CREATE TABLE public.staff_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type staff_notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT, -- 'order', 'invoice', 'payment', 'subscription'
  entity_id UUID,
  entity_number TEXT, -- ORD-xxxx, INV-xxxx, etc.
  client_id UUID,
  client_name TEXT,
  client_email TEXT,
  amount NUMERIC(10,2),
  is_read BOOLEAN DEFAULT false,
  read_by UUID REFERENCES auth.users(id),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_notifications ENABLE ROW LEVEL SECURITY;

-- Policies: Only admins and staff can view/update notifications
CREATE POLICY "Admins can view all notifications"
  ON public.staff_notifications FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_staff());

CREATE POLICY "Admins can mark notifications as read"
  ON public.staff_notifications FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.is_staff())
  WITH CHECK (public.is_admin() OR public.is_staff());

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_notifications;

-- Indexes for performance
CREATE INDEX idx_staff_notifications_unread ON public.staff_notifications(is_read, created_at DESC) WHERE is_read = false;
CREATE INDEX idx_staff_notifications_type ON public.staff_notifications(notification_type);
CREATE INDEX idx_staff_notifications_created ON public.staff_notifications(created_at DESC);

-- =============================================
-- TRIGGER: New Order Created
-- =============================================
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
    NEW.total
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_order();

-- =============================================
-- TRIGGER: Invoice Created (Billing V2)
-- =============================================
CREATE OR REPLACE FUNCTION public.notify_invoice_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer RECORD;
BEGIN
  -- Get customer info
  SELECT first_name, last_name, email INTO v_customer
  FROM public.billing_customers
  WHERE id = NEW.customer_id;

  INSERT INTO public.staff_notifications (
    notification_type,
    title,
    message,
    entity_type,
    entity_id,
    entity_number,
    client_name,
    client_email,
    amount
  ) VALUES (
    'invoice_created',
    CASE WHEN NEW.type = 'renewal' THEN 'Facture de renouvellement' ELSE 'Nouvelle facture' END,
    'Facture ' || NEW.invoice_number || ' créée pour ' || COALESCE(v_customer.first_name, '') || ' ' || COALESCE(v_customer.last_name, '') || ' - ' || NEW.total || ' $',
    'invoice',
    NEW.id,
    NEW.invoice_number,
    COALESCE(v_customer.first_name, '') || ' ' || COALESCE(v_customer.last_name, ''),
    v_customer.email,
    NEW.total
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_invoice_created
  AFTER INSERT ON public.billing_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_invoice_created();

-- =============================================
-- TRIGGER: Payment Received (Billing V2)
-- =============================================
CREATE OR REPLACE FUNCTION public.notify_payment_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer RECORD;
  v_invoice RECORD;
BEGIN
  -- Only notify when payment becomes confirmed/completed
  IF NEW.status IN ('confirmed', 'completed') AND (OLD.status IS NULL OR OLD.status NOT IN ('confirmed', 'completed')) THEN
    -- Get customer info
    SELECT first_name, last_name, email INTO v_customer
    FROM public.billing_customers
    WHERE id = NEW.customer_id;

    -- Get invoice number
    SELECT invoice_number INTO v_invoice
    FROM public.billing_invoices
    WHERE id = NEW.invoice_id;

    INSERT INTO public.staff_notifications (
      notification_type,
      title,
      message,
      entity_type,
      entity_id,
      entity_number,
      client_name,
      client_email,
      amount
    ) VALUES (
      'payment_received',
      'Paiement reçu',
      'Paiement de ' || NEW.amount || ' $ reçu de ' || COALESCE(v_customer.first_name, '') || ' ' || COALESCE(v_customer.last_name, '') || ' via ' || UPPER(NEW.method::text),
      'payment',
      NEW.id,
      v_invoice.invoice_number,
      COALESCE(v_customer.first_name, '') || ' ' || COALESCE(v_customer.last_name, ''),
      v_customer.email,
      NEW.amount
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_payment_received
  AFTER INSERT OR UPDATE ON public.billing_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payment_received();

-- =============================================
-- TRIGGER: Service Suspended/Cancelled
-- =============================================
CREATE OR REPLACE FUNCTION public.notify_service_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer RECORD;
  v_notification_type staff_notification_type;
  v_title TEXT;
BEGIN
  -- Only notify on status changes to suspended or cancelled
  IF NEW.status IN ('suspended', 'cancelled') AND OLD.status != NEW.status THEN
    -- Get customer info
    SELECT first_name, last_name, email INTO v_customer
    FROM public.billing_customers
    WHERE id = NEW.customer_id;

    IF NEW.status = 'suspended' THEN
      v_notification_type := 'service_suspended';
      v_title := 'Service suspendu';
    ELSE
      v_notification_type := 'service_cancelled';
      v_title := 'Service annulé';
    END IF;

    INSERT INTO public.staff_notifications (
      notification_type,
      title,
      message,
      entity_type,
      entity_id,
      client_name,
      client_email,
      amount
    ) VALUES (
      v_notification_type,
      v_title,
      NEW.plan_name || ' - ' || COALESCE(v_customer.first_name, '') || ' ' || COALESCE(v_customer.last_name, '') || ' (' || v_customer.email || ')',
      'subscription',
      NEW.id,
      COALESCE(v_customer.first_name, '') || ' ' || COALESCE(v_customer.last_name, ''),
      v_customer.email,
      NEW.plan_price
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_service_status_change
  AFTER UPDATE ON public.billing_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_service_status_change();