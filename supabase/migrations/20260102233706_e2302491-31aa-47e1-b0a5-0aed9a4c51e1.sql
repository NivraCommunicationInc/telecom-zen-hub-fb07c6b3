
-- =====================================================
-- PRE-LAUNCH SECURITY AUDIT MIGRATION
-- =====================================================

-- 1) FIX PUBLIC EXPOSURE: inventory_items
-- Remove public access policy, require authentication
DROP POLICY IF EXISTS "Anyone can view active inventory items" ON public.inventory_items;

CREATE POLICY "Authenticated users can view active inventory"
  ON public.inventory_items FOR SELECT
  TO authenticated
  USING (status = 'active');

-- 2) FIX PUBLIC EXPOSURE: promotions
-- Remove public access, require authentication for promo validation
DROP POLICY IF EXISTS "Anyone can view active promotions" ON public.promotions;

CREATE POLICY "Authenticated users can view active promotions"
  ON public.promotions FOR SELECT
  TO authenticated
  USING (status = 'active');

-- 3) FIX PUBLIC EXPOSURE: channel_packages
-- Remove public access, require authentication
DROP POLICY IF EXISTS "Anyone can view active packages" ON public.channel_packages;

CREATE POLICY "Authenticated users can view active channel packages"
  ON public.channel_packages FOR SELECT
  TO authenticated
  USING (is_active = true);

-- 4) FIX PUBLIC EXPOSURE: streaming_catalog (optional - less critical)
-- Keep for authenticated users only
DROP POLICY IF EXISTS "Anyone can view active streaming catalog" ON public.streaming_catalog;

CREATE POLICY "Authenticated users can view active streaming catalog"
  ON public.streaming_catalog FOR SELECT
  TO authenticated
  USING (status = 'active');

-- =====================================================
-- EMAIL QUEUE SYSTEM
-- =====================================================

-- Create email queue table for transactional emails
CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT UNIQUE NOT NULL, -- Idempotency key
  to_email TEXT NOT NULL,
  template_key TEXT NOT NULL,
  template_vars JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  last_error TEXT,
  provider_message_id TEXT,
  sent_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on email_queue
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- Only admins can view email queue (diagnostics)
CREATE POLICY "Admins can view email queue"
  ON public.email_queue FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert into email queue (service role)
CREATE POLICY "System can insert email queue"
  ON public.email_queue FOR INSERT
  WITH CHECK (true);

-- System can update email queue (service role)
CREATE POLICY "System can update email queue"
  ON public.email_queue FOR UPDATE
  USING (true);

-- Index for queue processing
CREATE INDEX IF NOT EXISTS idx_email_queue_status_retry 
  ON public.email_queue(status, next_retry_at) 
  WHERE status IN ('queued', 'processing');

-- Index for idempotency lookup
CREATE INDEX IF NOT EXISTS idx_email_queue_event_key 
  ON public.email_queue(event_key);

-- =====================================================
-- RATE LIMITING INFRASTRUCTURE
-- =====================================================

-- Create rate limit tracking table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- IP, user_id, or composite key
  action_type TEXT NOT NULL, -- login, password_reset, ticket_create, etc.
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE (identifier, action_type, window_start)
);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only system can manage rate limits (service role)
CREATE POLICY "System manages rate limits"
  ON public.rate_limits FOR ALL
  USING (true);

-- Index for rate limit checks
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup 
  ON public.rate_limits(identifier, action_type, window_start);

-- Auto-cleanup old rate limit entries (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits 
  WHERE window_start < now() - INTERVAL '1 hour';
END;
$$;

-- =====================================================
-- EMAIL QUEUE HELPER FUNCTIONS
-- =====================================================

-- Function to queue an email (idempotent)
CREATE OR REPLACE FUNCTION public.queue_email(
  p_event_key TEXT,
  p_to_email TEXT,
  p_template_key TEXT,
  p_template_vars JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_id UUID;
BEGIN
  -- Insert or do nothing if already exists (idempotency)
  INSERT INTO public.email_queue (event_key, to_email, template_key, template_vars)
  VALUES (p_event_key, p_to_email, p_template_key, p_template_vars)
  ON CONFLICT (event_key) DO NOTHING
  RETURNING id INTO v_email_id;
  
  -- If insert succeeded, return the new ID
  IF v_email_id IS NOT NULL THEN
    RETURN v_email_id;
  END IF;
  
  -- Otherwise, return the existing ID
  SELECT id INTO v_email_id FROM public.email_queue WHERE event_key = p_event_key;
  RETURN v_email_id;
END;
$$;

-- =====================================================
-- EVENT TRIGGERS FOR EMAIL + NOTIFICATIONS
-- =====================================================

-- Trigger function for order events
CREATE OR REPLACE FUNCTION public.trigger_order_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_email TEXT;
  v_client_name TEXT;
  v_template_key TEXT;
  v_event_key TEXT;
BEGIN
  -- Get client info
  SELECT email, COALESCE(full_name, 'Client') INTO v_client_email, v_client_name
  FROM public.profiles WHERE user_id = NEW.user_id;
  
  -- Skip if no email
  IF v_client_email IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Determine which email to send based on status change
  IF TG_OP = 'INSERT' THEN
    v_template_key := 'order_submitted';
    v_event_key := 'order_submitted_' || NEW.id::TEXT;
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'processing', 'processed' THEN
        v_template_key := 'order_processed';
        v_event_key := 'order_processed_' || NEW.id::TEXT;
      WHEN 'shipped' THEN
        v_template_key := 'order_shipped';
        v_event_key := 'order_shipped_' || NEW.id::TEXT;
      WHEN 'completed', 'completed_installation' THEN
        v_template_key := 'order_completed';
        v_event_key := 'order_completed_' || NEW.id::TEXT;
      WHEN 'cancelled' THEN
        v_template_key := 'order_cancelled';
        v_event_key := 'order_cancelled_' || NEW.id::TEXT;
      ELSE
        RETURN NEW;
    END CASE;
  ELSE
    RETURN NEW;
  END IF;
  
  -- Queue the email
  PERFORM public.queue_email(
    v_event_key,
    v_client_email,
    v_template_key,
    jsonb_build_object(
      'client_name', v_client_name,
      'order_id', NEW.id,
      'order_number', COALESCE(NEW.order_number, NEW.confirmation_number),
      'service_type', NEW.service_type,
      'status', NEW.status,
      'total_amount', COALESCE(NEW.total_amount, 0)
    )
  );
  
  RETURN NEW;
END;
$$;

-- Attach trigger to orders
DROP TRIGGER IF EXISTS tr_order_email ON public.orders;
CREATE TRIGGER tr_order_email
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_order_email();

-- Trigger function for invoice/billing events
CREATE OR REPLACE FUNCTION public.trigger_billing_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_email TEXT;
  v_client_name TEXT;
  v_template_key TEXT;
  v_event_key TEXT;
BEGIN
  -- Get client info
  SELECT email, COALESCE(full_name, 'Client') INTO v_client_email, v_client_name
  FROM public.profiles WHERE user_id = NEW.user_id;
  
  -- Use client_email if profile email is null
  IF v_client_email IS NULL THEN
    v_client_email := NEW.client_email;
  END IF;
  
  IF v_client_email IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Handle new invoice
  IF TG_OP = 'INSERT' THEN
    v_template_key := 'invoice_created';
    v_event_key := 'invoice_created_' || NEW.id::TEXT;
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'paid' THEN
        v_template_key := 'payment_received';
        v_event_key := 'payment_received_' || NEW.id::TEXT;
      WHEN 'overdue' THEN
        v_template_key := 'invoice_overdue';
        v_event_key := 'invoice_overdue_' || NEW.id::TEXT;
      WHEN 'failed', 'declined' THEN
        v_template_key := 'payment_failed';
        v_event_key := 'payment_failed_' || NEW.id::TEXT;
      ELSE
        RETURN NEW;
    END CASE;
  ELSE
    RETURN NEW;
  END IF;
  
  PERFORM public.queue_email(
    v_event_key,
    v_client_email,
    v_template_key,
    jsonb_build_object(
      'client_name', v_client_name,
      'invoice_id', NEW.id,
      'invoice_number', NEW.invoice_number,
      'amount', NEW.amount,
      'due_date', NEW.due_date,
      'status', NEW.status
    )
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_billing_email ON public.billing;
CREATE TRIGGER tr_billing_email
  AFTER INSERT OR UPDATE OF status ON public.billing
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_billing_email();

-- Trigger for ticket events
CREATE OR REPLACE FUNCTION public.trigger_ticket_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_email TEXT;
  v_client_name TEXT;
BEGIN
  -- Get client info
  SELECT email, COALESCE(full_name, 'Client') INTO v_client_email, v_client_name
  FROM public.profiles WHERE user_id = NEW.user_id;
  
  IF v_client_email IS NULL THEN
    v_client_email := NEW.client_email;
  END IF;
  
  IF v_client_email IS NULL THEN
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'INSERT' THEN
    PERFORM public.queue_email(
      'ticket_created_' || NEW.id::TEXT,
      v_client_email,
      'ticket_created',
      jsonb_build_object(
        'client_name', v_client_name,
        'ticket_id', NEW.id,
        'ticket_number', NEW.ticket_number,
        'subject', NEW.subject,
        'status', NEW.status
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_ticket_email ON public.support_tickets;
CREATE TRIGGER tr_ticket_email
  AFTER INSERT ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_ticket_email();

-- Trigger for ticket replies
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
  -- Only notify client if reply is from staff
  IF NEW.author_role NOT IN ('admin', 'employee', 'technician') THEN
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

DROP TRIGGER IF EXISTS tr_ticket_reply_email ON public.ticket_replies;
CREATE TRIGGER tr_ticket_reply_email
  AFTER INSERT ON public.ticket_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_ticket_reply_email();

-- Trigger for appointment events
CREATE OR REPLACE FUNCTION public.trigger_appointment_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_email TEXT;
  v_client_name TEXT;
  v_template_key TEXT;
  v_event_key TEXT;
BEGIN
  -- Get client info
  IF NEW.client_id IS NOT NULL THEN
    SELECT email, COALESCE(full_name, 'Client') INTO v_client_email, v_client_name
    FROM public.profiles WHERE user_id = NEW.client_id;
  END IF;
  
  IF v_client_email IS NULL THEN
    v_client_email := NEW.client_email;
  END IF;
  
  IF v_client_email IS NULL THEN
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'INSERT' THEN
    v_template_key := 'appointment_scheduled';
    v_event_key := 'appointment_scheduled_' || NEW.id::TEXT;
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'cancelled' THEN
      v_template_key := 'appointment_cancelled';
      v_event_key := 'appointment_cancelled_' || NEW.id::TEXT;
    ELSE
      v_template_key := 'appointment_updated';
      v_event_key := 'appointment_updated_' || NEW.id::TEXT || '_' || NEW.status;
    END IF;
  ELSIF OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at THEN
    v_template_key := 'appointment_updated';
    v_event_key := 'appointment_rescheduled_' || NEW.id::TEXT;
  ELSE
    RETURN NEW;
  END IF;
  
  PERFORM public.queue_email(
    v_event_key,
    v_client_email,
    v_template_key,
    jsonb_build_object(
      'client_name', COALESCE(v_client_name, 'Client'),
      'appointment_id', NEW.id,
      'appointment_number', NEW.appointment_number,
      'title', NEW.title,
      'scheduled_at', NEW.scheduled_at,
      'status', NEW.status,
      'service_address', NEW.service_address
    )
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_appointment_email ON public.appointments;
CREATE TRIGGER tr_appointment_email
  AFTER INSERT OR UPDATE OF status, scheduled_at ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_appointment_email();

-- Add employees policy for inventory (they need to see items for orders)
CREATE POLICY "Employees can view inventory items"
  ON public.inventory_items FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'employee'::app_role));

-- Add employees policy for promotions (they need to validate promos)
CREATE POLICY "Employees can view promotions"
  ON public.promotions FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'employee'::app_role));

-- Add employees policy for channel packages
CREATE POLICY "Employees can view channel packages"
  ON public.channel_packages FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'employee'::app_role));
