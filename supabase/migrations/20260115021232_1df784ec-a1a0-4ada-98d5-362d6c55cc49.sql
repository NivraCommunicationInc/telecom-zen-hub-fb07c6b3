-- Create table for SMS campaigns/marketing history
CREATE TABLE public.sms_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT NOT NULL,
  recipients_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_by_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sms_campaigns ENABLE ROW LEVEL SECURITY;

-- Policy for admins/employees to read all campaigns
CREATE POLICY "Admins can view all SMS campaigns"
  ON public.sms_campaigns
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'employee'::app_role)
  );

-- Policy for admins/employees to insert campaigns
CREATE POLICY "Admins can insert SMS campaigns"
  ON public.sms_campaigns
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'employee'::app_role)
  );

-- Policy for admins/employees to update campaigns
CREATE POLICY "Admins can update SMS campaigns"
  ON public.sms_campaigns
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'employee'::app_role)
  );

-- Create index for faster queries
CREATE INDEX idx_sms_campaigns_created_at ON public.sms_campaigns(created_at DESC);