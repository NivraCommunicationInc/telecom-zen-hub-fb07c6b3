-- Create admin notification logs table
CREATE TABLE IF NOT EXISTS public.admin_notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_id TEXT,
  event_number TEXT,
  client_name TEXT,
  client_email TEXT,
  priority TEXT DEFAULT 'normal',
  email_id TEXT,
  sent_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add index for querying by event type
CREATE INDEX idx_admin_notification_logs_event_type ON public.admin_notification_logs(event_type);
CREATE INDEX idx_admin_notification_logs_created_at ON public.admin_notification_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.admin_notification_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view notification logs
CREATE POLICY "Admins can view notification logs"
ON public.admin_notification_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
    AND au.is_active = true
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'employee')
  )
);