-- Create client_activity_logs table for audit trail
CREATE TABLE public.client_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  actor_user_id UUID NOT NULL,
  actor_name TEXT,
  actor_role TEXT,
  action_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  summary TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create index for faster queries
CREATE INDEX idx_client_activity_logs_client_id ON public.client_activity_logs(client_id);
CREATE INDEX idx_client_activity_logs_created_at ON public.client_activity_logs(created_at DESC);
CREATE INDEX idx_client_activity_logs_action_type ON public.client_activity_logs(action_type);

-- Enable RLS
ALTER TABLE public.client_activity_logs ENABLE ROW LEVEL SECURITY;

-- Admin can view all logs
CREATE POLICY "Admins can view all client activity logs"
ON public.client_activity_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Staff can insert logs (admin, employee, technician)
CREATE POLICY "Staff can insert client activity logs"
ON public.client_activity_logs
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role) OR 
  has_role(auth.uid(), 'technician'::app_role)
);

-- Only admin can delete (for cleanup if needed)
CREATE POLICY "Only admins can delete client activity logs"
ON public.client_activity_logs
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));