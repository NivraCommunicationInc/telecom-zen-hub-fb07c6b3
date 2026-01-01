-- Add status and incident tracking fields to tv_channels table
ALTER TABLE public.tv_channels 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'shutdown', 'end_of_life')),
ADD COLUMN IF NOT EXISTS incident_type TEXT CHECK (incident_type IN ('service_interruption', 'permanently_closed', 'discontinued', 'legal_removal', NULL)),
ADD COLUMN IF NOT EXISTS incident_reason TEXT,
ADD COLUMN IF NOT EXISTS incident_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS replacement_channel_id UUID REFERENCES public.tv_channels(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_by UUID;

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_tv_channels_status ON public.tv_channels(status);

-- Create trigger to update updated_at
CREATE OR REPLACE TRIGGER update_tv_channels_updated_at
BEFORE UPDATE ON public.tv_channels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create channel_activity_logs table for detailed channel change tracking
CREATE TABLE IF NOT EXISTS public.channel_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.tv_channels(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  actor_id UUID NOT NULL,
  actor_role TEXT,
  actor_name TEXT,
  actor_email TEXT,
  client_id UUID,
  client_email TEXT,
  notified_client BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on channel_activity_logs
ALTER TABLE public.channel_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS policy: Admins can manage all channel activity logs
CREATE POLICY "Admins can manage channel activity logs"
ON public.channel_activity_logs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policy: Employees can view channel activity logs
CREATE POLICY "Employees can view channel activity logs"
ON public.channel_activity_logs
FOR SELECT
USING (has_role(auth.uid(), 'employee'::app_role));

-- RLS policy: Technicians can view channel activity logs
CREATE POLICY "Technicians can view channel activity logs"
ON public.channel_activity_logs
FOR SELECT
USING (has_role(auth.uid(), 'technician'::app_role));