-- Create a table to queue automated email triggers
CREATE TABLE IF NOT EXISTS public.email_trigger_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL,
  client_id UUID NOT NULL,
  client_email TEXT NOT NULL,
  client_name TEXT,
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for processing pending triggers
CREATE INDEX idx_email_trigger_queue_pending ON public.email_trigger_queue(status, created_at) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.email_trigger_queue ENABLE ROW LEVEL SECURITY;

-- Admin can view all triggers
CREATE POLICY "Admins can view email triggers" ON public.email_trigger_queue
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)
    OR EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND is_active = true)
  );

-- Function to queue welcome email when profile is created
CREATE OR REPLACE FUNCTION public.trigger_welcome_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if there's an active welcome automation rule
  IF EXISTS (
    SELECT 1 FROM email_automation_rules 
    WHERE trigger_type = 'welcome' AND is_active = true
  ) THEN
    INSERT INTO email_trigger_queue (trigger_type, client_id, client_email, client_name, metadata)
    VALUES (
      'welcome',
      NEW.id,
      NEW.email,
      NEW.full_name,
      jsonb_build_object('phone', NEW.phone, 'created_at', NEW.created_at)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to queue birthday email
CREATE OR REPLACE FUNCTION public.trigger_birthday_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if birthday is today and automation is active
  IF NEW.date_of_birth IS NOT NULL 
     AND EXTRACT(MONTH FROM NEW.date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
     AND EXTRACT(DAY FROM NEW.date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE)
     AND EXISTS (SELECT 1 FROM email_automation_rules WHERE trigger_type = 'birthday' AND is_active = true)
  THEN
    INSERT INTO email_trigger_queue (trigger_type, client_id, client_email, client_name, metadata)
    VALUES (
      'birthday',
      NEW.id,
      NEW.email,
      NEW.full_name,
      jsonb_build_object('date_of_birth', NEW.date_of_birth)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to queue payment reminder
CREATE OR REPLACE FUNCTION public.trigger_payment_reminder()
RETURNS TRIGGER AS $$
DECLARE
  v_client_email TEXT;
  v_client_name TEXT;
BEGIN
  -- Only for overdue invoices
  IF NEW.status = 'overdue' AND OLD.status != 'overdue' THEN
    -- Get client info
    SELECT email, full_name INTO v_client_email, v_client_name
    FROM profiles WHERE id = NEW.user_id;
    
    IF v_client_email IS NOT NULL AND EXISTS (
      SELECT 1 FROM email_automation_rules WHERE trigger_type = 'payment_overdue' AND is_active = true
    ) THEN
      INSERT INTO email_trigger_queue (trigger_type, client_id, client_email, client_name, metadata)
      VALUES (
        'payment_overdue',
        NEW.user_id,
        v_client_email,
        v_client_name,
        jsonb_build_object(
          'invoice_number', NEW.invoice_number,
          'amount', NEW.amount,
          'due_date', NEW.due_date
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers on profiles table
DROP TRIGGER IF EXISTS on_profile_created_welcome ON public.profiles;
CREATE TRIGGER on_profile_created_welcome
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_welcome_email();

-- Trigger for billing status changes
DROP TRIGGER IF EXISTS on_billing_overdue ON public.billing;
CREATE TRIGGER on_billing_overdue
  AFTER UPDATE ON public.billing
  FOR EACH ROW
  WHEN (NEW.status = 'overdue' AND OLD.status IS DISTINCT FROM 'overdue')
  EXECUTE FUNCTION public.trigger_payment_reminder();