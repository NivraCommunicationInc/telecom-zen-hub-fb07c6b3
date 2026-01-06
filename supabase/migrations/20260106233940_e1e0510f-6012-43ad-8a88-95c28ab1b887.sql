-- Create dispute reason codes enum
CREATE TYPE dispute_reason_code AS ENUM (
  'duplicate_charge',
  'incorrect_amount',
  'service_not_received',
  'unauthorized',
  'fraud',
  'other'
);

-- Create dispute status enum
CREATE TYPE dispute_status AS ENUM (
  'submitted',
  'under_review',
  'awaiting_client',
  'resolved_approved',
  'resolved_rejected'
);

-- Create payment_disputes table
CREATE TABLE public.payment_disputes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dispute_number TEXT UNIQUE,
  user_id UUID NOT NULL,
  payment_id UUID NOT NULL REFERENCES public.billing(id) ON DELETE RESTRICT,
  reason_code dispute_reason_code NOT NULL,
  client_message TEXT,
  status dispute_status NOT NULL DEFAULT 'submitted',
  public_message TEXT,
  staff_notes TEXT,
  resolution_notes TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_by_id UUID,
  processed_by_name TEXT,
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Create sequence for dispute numbers
CREATE SEQUENCE dispute_number_seq START 1;

-- Create function to generate dispute number
CREATE OR REPLACE FUNCTION public.generate_dispute_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RETURN 'DIS-' || LPAD(nextval('dispute_number_seq')::TEXT, 6, '0');
END;
$$;

-- Create trigger to set dispute number
CREATE OR REPLACE FUNCTION public.set_dispute_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.dispute_number IS NULL THEN
    NEW.dispute_number := generate_dispute_number();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_dispute_number_trigger
BEFORE INSERT OR UPDATE ON public.payment_disputes
FOR EACH ROW
EXECUTE FUNCTION public.set_dispute_number();

-- Enable RLS
ALTER TABLE public.payment_disputes ENABLE ROW LEVEL SECURITY;

-- Client: can SELECT own rows
CREATE POLICY "Clients can view their own disputes"
ON public.payment_disputes
FOR SELECT
USING (auth.uid() = user_id);

-- Client: can INSERT own rows
CREATE POLICY "Clients can create disputes"
ON public.payment_disputes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Client: can UPDATE client_message ONLY when status = awaiting_client
CREATE POLICY "Clients can respond when awaiting"
ON public.payment_disputes
FOR UPDATE
USING (auth.uid() = user_id AND status = 'awaiting_client')
WITH CHECK (
  auth.uid() = user_id 
  AND status = 'awaiting_client'
);

-- Admin/Employee: can SELECT all
CREATE POLICY "Staff can view all disputes"
ON public.payment_disputes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'employee')
  )
);

-- Admin/Employee: can UPDATE all
CREATE POLICY "Staff can update all disputes"
ON public.payment_disputes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'employee')
  )
);

-- Create notification function for disputes
CREATE OR REPLACE FUNCTION public.notify_on_dispute_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_ids UUID[];
  v_admin_id UUID;
BEGIN
  -- Notify admins on new dispute
  IF TG_OP = 'INSERT' THEN
    SELECT ARRAY_AGG(ur.user_id) INTO v_admin_ids
    FROM public.user_roles ur WHERE ur.role = 'admin';
    
    IF v_admin_ids IS NOT NULL THEN
      FOREACH v_admin_id IN ARRAY v_admin_ids LOOP
        PERFORM public.create_notification(
          v_admin_id,
          'admin',
          'dispute',
          'Nouvelle contestation de paiement',
          'Contestation #' || NEW.dispute_number,
          '/admin/payment-disputes',
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
      'dispute',
      CASE 
        WHEN NEW.status = 'under_review' THEN 'Contestation en cours d''examen'
        WHEN NEW.status = 'awaiting_client' THEN 'Information requise pour votre contestation'
        WHEN NEW.status = 'resolved_approved' THEN 'Contestation approuvée'
        WHEN NEW.status = 'resolved_rejected' THEN 'Contestation refusée'
        ELSE 'Mise à jour de votre contestation'
      END,
      'Contestation #' || NEW.dispute_number,
      '/portal/invoices',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_on_dispute_change_trigger
AFTER INSERT OR UPDATE ON public.payment_disputes
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_dispute_change();

-- Create email trigger function for disputes
CREATE OR REPLACE FUNCTION public.trigger_dispute_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_email TEXT;
  v_client_name TEXT;
  v_template_key TEXT;
  v_event_key TEXT;
  v_payment_info RECORD;
BEGIN
  -- Get client info
  SELECT email, COALESCE(full_name, 'Client') INTO v_client_email, v_client_name
  FROM public.profiles WHERE user_id = NEW.user_id;
  
  IF v_client_email IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get payment info
  SELECT invoice_number, amount INTO v_payment_info
  FROM public.billing WHERE id = NEW.payment_id;
  
  IF TG_OP = 'INSERT' THEN
    v_template_key := 'dispute_received';
    v_event_key := 'dispute_received_' || NEW.id::TEXT;
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'awaiting_client' THEN
        v_template_key := 'dispute_request_info';
        v_event_key := 'dispute_request_info_' || NEW.id::TEXT;
      WHEN 'resolved_approved' THEN
        v_template_key := 'dispute_resolved_approved';
        v_event_key := 'dispute_resolved_approved_' || NEW.id::TEXT;
      WHEN 'resolved_rejected' THEN
        v_template_key := 'dispute_resolved_rejected';
        v_event_key := 'dispute_resolved_rejected_' || NEW.id::TEXT;
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
      'dispute_id', NEW.id,
      'dispute_number', NEW.dispute_number,
      'payment_reference', v_payment_info.invoice_number,
      'amount', v_payment_info.amount,
      'reason_code', NEW.reason_code::TEXT,
      'status', NEW.status::TEXT,
      'public_message', NEW.public_message,
      'resolution_notes', NEW.resolution_notes,
      'rejection_reason', NEW.rejection_reason
    )
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_dispute_email_trigger
AFTER INSERT OR UPDATE ON public.payment_disputes
FOR EACH ROW
EXECUTE FUNCTION public.trigger_dispute_email();