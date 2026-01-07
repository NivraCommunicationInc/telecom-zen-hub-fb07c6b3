-- Add cancellation fields to client_streaming_subscriptions
ALTER TABLE public.client_streaming_subscriptions 
ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS cancellation_reason text,
ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
ADD COLUMN IF NOT EXISTS cancelled_by_employee_id uuid,
ADD COLUMN IF NOT EXISTS cancelled_by_employee_email text,
ADD COLUMN IF NOT EXISTS effective_end_date date;

-- Add lockout fields to employee_pin_attempts if not present (server-side lockout)
-- Update employee_pin_unlocks to add more tracking
ALTER TABLE public.employee_pin_unlocks 
ADD COLUMN IF NOT EXISTS created_by_server boolean DEFAULT true;

-- Create employee_audit_logs table for comprehensive audit trail if not exists
CREATE TABLE IF NOT EXISTS public.employee_operations_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  employee_email text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  client_id uuid,
  account_id uuid,
  result text NOT NULL,
  reason text,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_operations_audit ENABLE ROW LEVEL SECURITY;

-- Only service role can insert (edge functions)
CREATE POLICY "Service role full access to employee_operations_audit"
ON public.employee_operations_audit
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_employee_operations_audit_employee 
ON public.employee_operations_audit(employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_operations_audit_action 
ON public.employee_operations_audit(action, created_at DESC);