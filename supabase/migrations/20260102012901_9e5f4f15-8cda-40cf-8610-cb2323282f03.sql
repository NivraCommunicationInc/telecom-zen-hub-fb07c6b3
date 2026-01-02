-- Add security fields to profiles table for fraud/risk handling
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS security_status TEXT NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS security_reason TEXT,
ADD COLUMN IF NOT EXISTS security_flagged_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS security_flagged_order_id UUID,
ADD COLUMN IF NOT EXISTS security_requires_pin_reset BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS security_alert_level TEXT DEFAULT 'none';

-- Add check constraints
ALTER TABLE public.profiles
ADD CONSTRAINT security_status_check CHECK (security_status IN ('active', 'suspended')),
ADD CONSTRAINT security_alert_level_check CHECK (security_alert_level IN ('none', 'risk', 'fraud'));

-- Create a function to flag a client for fraud/risk
CREATE OR REPLACE FUNCTION public.flag_client_for_risk(
  p_client_id UUID,
  p_order_id UUID,
  p_alert_level TEXT DEFAULT 'risk',
  p_reason TEXT DEFAULT 'Order flagged for risk/fraud review'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    security_status = 'suspended',
    security_alert_level = p_alert_level,
    security_reason = p_reason,
    security_flagged_at = now(),
    security_flagged_order_id = p_order_id,
    security_requires_pin_reset = true
  WHERE user_id = p_client_id;
END;
$$;

-- Create a function to lift client suspension (admin only)
CREATE OR REPLACE FUNCTION public.lift_client_suspension(
  p_client_id UUID,
  p_require_pin_reset BOOLEAN DEFAULT true
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    security_status = 'active',
    security_alert_level = 'none',
    security_reason = NULL,
    security_flagged_at = NULL,
    security_flagged_order_id = NULL,
    security_requires_pin_reset = p_require_pin_reset
  WHERE user_id = p_client_id;
END;
$$;

-- Create security action logs table
CREATE TABLE IF NOT EXISTS public.security_action_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  client_email TEXT,
  action TEXT NOT NULL,
  action_by_id UUID,
  action_by_name TEXT,
  action_by_role TEXT,
  order_id UUID,
  reason TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on security action logs
ALTER TABLE public.security_action_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view security logs
CREATE POLICY "Admins can manage security logs"
ON public.security_action_logs FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Staff can insert security logs
CREATE POLICY "Staff can insert security logs"
ON public.security_action_logs FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'employee'::app_role) OR
  has_role(auth.uid(), 'technician'::app_role)
);