
-- ============================================================================
-- C) ACCOUNT ACCESS LOGS - Track staff access to client accounts
-- ============================================================================

-- Create account_access_logs table
CREATE TABLE IF NOT EXISTS public.account_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id uuid NOT NULL REFERENCES auth.users(id),
  client_user_id uuid NOT NULL REFERENCES auth.users(id),
  method text NOT NULL CHECK (method IN ('pin', 'email_postal_dob', 'admin_bypass', 'recovery')),
  reason text NOT NULL,
  verified_fields jsonb DEFAULT '[]'::jsonb,
  portal text DEFAULT 'admin',
  access_granted boolean NOT NULL DEFAULT true,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.account_access_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies - only admins can view/insert
CREATE POLICY "Admins can view access logs"
  ON public.account_access_logs FOR SELECT
  USING (public.is_admin_user());

CREATE POLICY "Staff can insert access logs"
  ON public.account_access_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Index for performance
CREATE INDEX idx_account_access_logs_client ON public.account_access_logs(client_user_id);
CREATE INDEX idx_account_access_logs_staff ON public.account_access_logs(staff_user_id);
CREATE INDEX idx_account_access_logs_created ON public.account_access_logs(created_at DESC);

-- ============================================================================
-- D) EMAIL DELIVERY LOGS - Track email send status from provider
-- ============================================================================

-- Add provider tracking columns to email_queue if not exists
ALTER TABLE public.email_queue ADD COLUMN IF NOT EXISTS provider_message_id text;
ALTER TABLE public.email_queue ADD COLUMN IF NOT EXISTS provider_status text;
ALTER TABLE public.email_queue ADD COLUMN IF NOT EXISTS provider_response jsonb;
ALTER TABLE public.email_queue ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE public.email_queue ADD COLUMN IF NOT EXISTS opened_at timestamptz;
ALTER TABLE public.email_queue ADD COLUMN IF NOT EXISTS clicked_at timestamptz;
ALTER TABLE public.email_queue ADD COLUMN IF NOT EXISTS bounced_at timestamptz;

-- Index for admin email activity view
CREATE INDEX IF NOT EXISTS idx_email_queue_provider_id ON public.email_queue(provider_message_id) WHERE provider_message_id IS NOT NULL;
