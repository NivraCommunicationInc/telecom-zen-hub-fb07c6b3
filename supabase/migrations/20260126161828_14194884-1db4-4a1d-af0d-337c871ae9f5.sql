-- =====================================================
-- PHASE 3: PROFILE ENHANCEMENTS
-- 2FA setup, notification preferences, language, account deletion, etc.
-- =====================================================

-- 1. Add new columns to profiles table for preferences
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'fr' CHECK (preferred_language IN ('fr', 'en')),
ADD COLUMN IF NOT EXISTS notification_channel TEXT DEFAULT 'email' CHECK (notification_channel IN ('email', 'sms', 'both')),
ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mfa_secret TEXT,
ADD COLUMN IF NOT EXISTS mfa_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pending_email TEXT,
ADD COLUMN IF NOT EXISTS pending_email_token TEXT,
ADD COLUMN IF NOT EXISTS pending_email_expires_at TIMESTAMPTZ;

-- 2. Create account deletion requests table (Loi 25 compliance)
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('deactivation', 'deletion')),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by UUID,
  processed_by_role TEXT,
  admin_notes TEXT,
  data_export_completed BOOLEAN DEFAULT false,
  final_deletion_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on account_deletion_requests
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Clients can view and create their own deletion requests
CREATE POLICY "Clients can view own deletion requests"
  ON public.account_deletion_requests FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "Clients can create deletion requests"
  ON public.account_deletion_requests FOR INSERT
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "Clients can cancel pending deletion requests"
  ON public.account_deletion_requests FOR UPDATE
  USING (client_id = auth.uid() AND status = 'pending');

-- 3. Add sms_notifications column to client_email_preferences
ALTER TABLE public.client_email_preferences
ADD COLUMN IF NOT EXISTS sms_reminders BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sms_invoices BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sms_service_updates BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT DEFAULT 'email' CHECK (preferred_contact_method IN ('email', 'sms', 'both'));

-- 4. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_deletion_requests_client ON public.account_deletion_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON public.account_deletion_requests(status);

-- 5. Add trigger for updated_at on deletion requests
CREATE OR REPLACE FUNCTION public.update_deletion_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS update_deletion_requests_updated_at ON public.account_deletion_requests;
CREATE TRIGGER update_deletion_requests_updated_at
  BEFORE UPDATE ON public.account_deletion_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_deletion_request_updated_at();

-- 6. Create email change verification table
CREATE TABLE IF NOT EXISTS public.email_change_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_email TEXT NOT NULL,
  new_email TEXT NOT NULL,
  verification_token TEXT NOT NULL,
  old_email_verified BOOLEAN DEFAULT false,
  new_email_verified BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'old_verified', 'completed', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(verification_token)
);

-- Enable RLS on email_change_requests
ALTER TABLE public.email_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own email change requests"
  ON public.email_change_requests FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "Clients can create email change requests"
  ON public.email_change_requests FOR INSERT
  WITH CHECK (client_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_email_change_client ON public.email_change_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_email_change_token ON public.email_change_requests(verification_token);