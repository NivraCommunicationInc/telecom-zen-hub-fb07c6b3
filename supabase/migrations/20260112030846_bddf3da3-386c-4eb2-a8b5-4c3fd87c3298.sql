-- Table for logging telephony actions (calls/SMS) for audit purposes
CREATE TABLE public.telephony_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('call', 'sms')),
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  phone_number TEXT,
  duration_seconds INTEGER,
  notes TEXT,
  agent_user_id UUID,
  agent_name TEXT,
  agent_email TEXT,
  openphone_call_id TEXT,
  openphone_message_id TEXT,
  raw_payload JSONB
);

-- Indexes for efficient querying
CREATE INDEX idx_telephony_logs_client_id ON public.telephony_logs(client_id);
CREATE INDEX idx_telephony_logs_created_at ON public.telephony_logs(created_at DESC);
CREATE INDEX idx_telephony_logs_agent ON public.telephony_logs(agent_user_id);
CREATE INDEX idx_telephony_logs_action ON public.telephony_logs(action);

-- Enable RLS
ALTER TABLE public.telephony_logs ENABLE ROW LEVEL SECURITY;

-- Staff can view all logs
CREATE POLICY "Staff can view telephony logs"
ON public.telephony_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'employee')
  )
);

-- Staff can insert logs
CREATE POLICY "Staff can insert telephony logs"
ON public.telephony_logs FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'employee')
  )
);

-- Add comment
COMMENT ON TABLE public.telephony_logs IS 'Audit log for telephony actions (calls/SMS) with clients via OpenPhone integration';