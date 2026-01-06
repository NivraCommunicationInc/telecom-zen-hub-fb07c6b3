-- Create enums for service cancellation
CREATE TYPE public.cancellation_service_type AS ENUM ('mobile', 'internet', 'tv', 'security', 'streaming', 'bundle');
CREATE TYPE public.cancellation_reason_code AS ENUM ('price', 'moving', 'not_needed', 'service_issue', 'billing_issue', 'other');
CREATE TYPE public.cancellation_status AS ENUM ('requested', 'under_review', 'awaiting_client', 'approved', 'scheduled', 'completed', 'declined');

-- Create service_cancellation_requests table
CREATE TABLE public.service_cancellation_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID REFERENCES public.accounts(id),
  service_type public.cancellation_service_type NOT NULL,
  service_identifier TEXT,
  reason_code public.cancellation_reason_code NOT NULL,
  reason_details TEXT,
  requested_effective_date DATE,
  effective_date DATE,
  status public.cancellation_status NOT NULL DEFAULT 'requested',
  staff_notes TEXT,
  decline_reason TEXT,
  public_message TEXT,
  request_number TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by_role TEXT NOT NULL DEFAULT 'client',
  processed_by_id UUID,
  processed_by_name TEXT,
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Create sequence for request numbers
CREATE SEQUENCE public.cancellation_request_seq START 1000;

-- Function to generate request number
CREATE OR REPLACE FUNCTION public.generate_cancellation_request_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.request_number := 'CAN-' || LPAD(nextval('public.cancellation_request_seq')::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for request number
CREATE TRIGGER set_cancellation_request_number
  BEFORE INSERT ON public.service_cancellation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_cancellation_request_number();

-- Trigger for updated_at
CREATE TRIGGER update_cancellation_requests_updated_at
  BEFORE UPDATE ON public.service_cancellation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.service_cancellation_requests ENABLE ROW LEVEL SECURITY;

-- RLS: Clients can view their own requests
CREATE POLICY "Clients can view own cancellation requests"
  ON public.service_cancellation_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS: Clients can create their own requests
CREATE POLICY "Clients can create own cancellation requests"
  ON public.service_cancellation_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS: Staff can view all requests (check user_roles table)
CREATE POLICY "Staff can view all cancellation requests"
  ON public.service_cancellation_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'employee')
    )
  );

-- RLS: Staff can update all requests
CREATE POLICY "Staff can update cancellation requests"
  ON public.service_cancellation_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'employee')
    )
  );

-- Index for common queries
CREATE INDEX idx_cancellation_requests_user ON public.service_cancellation_requests(user_id);
CREATE INDEX idx_cancellation_requests_status ON public.service_cancellation_requests(status);
CREATE INDEX idx_cancellation_requests_created ON public.service_cancellation_requests(created_at DESC);

-- Notification trigger for cancellation requests
CREATE OR REPLACE FUNCTION public.notify_on_cancellation_request()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_ids UUID[];
  v_admin_id UUID;
BEGIN
  -- Notify admins on new request
  IF TG_OP = 'INSERT' THEN
    SELECT ARRAY_AGG(ur.user_id) INTO v_admin_ids
    FROM public.user_roles ur WHERE ur.role = 'admin';
    
    IF v_admin_ids IS NOT NULL THEN
      FOREACH v_admin_id IN ARRAY v_admin_ids LOOP
        PERFORM public.create_notification(
          v_admin_id,
          'admin',
          'cancellation',
          'Nouvelle demande d''annulation',
          'Demande #' || NEW.request_number || ' - ' || NEW.service_type::TEXT,
          '/admin/cancellations',
          NEW.id
        );
      END LOOP;
    END IF;
  END IF;
  
  -- Notify client on status change
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'client',
      'cancellation',
      CASE 
        WHEN NEW.status = 'approved' THEN 'Demande d''annulation approuvée'
        WHEN NEW.status = 'scheduled' THEN 'Annulation planifiée'
        WHEN NEW.status = 'completed' THEN 'Annulation complétée'
        WHEN NEW.status = 'declined' THEN 'Demande d''annulation refusée'
        WHEN NEW.status = 'awaiting_client' THEN 'Information requise'
        ELSE 'Mise à jour demande annulation'
      END,
      'Demande #' || NEW.request_number,
      '/portal/cancellations',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER notify_cancellation_request
  AFTER INSERT OR UPDATE ON public.service_cancellation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_cancellation_request();

-- Email trigger for cancellation requests
CREATE OR REPLACE FUNCTION public.trigger_cancellation_email()
RETURNS TRIGGER AS $$
DECLARE
  v_client_email TEXT;
  v_client_name TEXT;
  v_template_key TEXT;
  v_event_key TEXT;
BEGIN
  -- Get client info
  SELECT email, COALESCE(full_name, 'Client') INTO v_client_email, v_client_name
  FROM public.profiles WHERE user_id = NEW.user_id;
  
  IF v_client_email IS NULL THEN
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'INSERT' THEN
    v_template_key := 'cancellation_received';
    v_event_key := 'cancellation_received_' || NEW.id::TEXT;
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'approved', 'scheduled' THEN
        v_template_key := 'cancellation_scheduled';
        v_event_key := 'cancellation_scheduled_' || NEW.id::TEXT;
      WHEN 'completed' THEN
        v_template_key := 'cancellation_completed';
        v_event_key := 'cancellation_completed_' || NEW.id::TEXT;
      WHEN 'declined' THEN
        v_template_key := 'cancellation_declined';
        v_event_key := 'cancellation_declined_' || NEW.id::TEXT;
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
      'request_id', NEW.id,
      'request_number', NEW.request_number,
      'service_type', NEW.service_type::TEXT,
      'effective_date', NEW.effective_date,
      'status', NEW.status::TEXT,
      'decline_reason', NEW.decline_reason,
      'public_message', NEW.public_message
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_cancellation_email
  AFTER INSERT OR UPDATE ON public.service_cancellation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_cancellation_email();