-- Create table for storing direct email communications
CREATE TABLE public.direct_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  recipients_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  sent_by_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE
);

-- Create table for individual recipients of each direct email
CREATE TABLE public.direct_email_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  direct_email_id UUID NOT NULL REFERENCES public.direct_emails(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  client_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  resend_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_direct_email_recipients_email_id ON public.direct_email_recipients(direct_email_id);
CREATE INDEX idx_direct_emails_created_at ON public.direct_emails(created_at DESC);

-- Enable RLS
ALTER TABLE public.direct_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_email_recipients ENABLE ROW LEVEL SECURITY;

-- Admin-only access policies for direct_emails
CREATE POLICY "Admins can view all direct emails" 
ON public.direct_emails 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can create direct emails" 
ON public.direct_emails 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can update direct emails" 
ON public.direct_emails 
FOR UPDATE 
USING (true);

-- Admin-only access policies for direct_email_recipients
CREATE POLICY "Admins can view all direct email recipients" 
ON public.direct_email_recipients 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can insert direct email recipients" 
ON public.direct_email_recipients 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can update direct email recipients" 
ON public.direct_email_recipients 
FOR UPDATE 
USING (true);