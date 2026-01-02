
-- Add client PIN fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS client_pin TEXT,
ADD COLUMN IF NOT EXISTS pin_failed_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pin_lockout_until TIMESTAMP WITH TIME ZONE;

-- Create authorized_users table for second contacts
CREATE TABLE public.authorized_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  relationship_label TEXT,
  phone TEXT,
  email TEXT,
  permission_level TEXT NOT NULL DEFAULT 'limited' CHECK (permission_level IN ('full', 'limited')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  created_by_role TEXT
);

-- Create client_access_logs table for audit trail
CREATE TABLE public.client_access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  client_name TEXT,
  staff_user_id UUID NOT NULL,
  staff_name TEXT NOT NULL,
  staff_email TEXT,
  staff_role TEXT NOT NULL,
  access_method TEXT NOT NULL CHECK (access_method IN ('pin', 'email_otp', 'dob_postal', 'email_postal', 'admin_bypass')),
  access_reason TEXT,
  result TEXT NOT NULL CHECK (result IN ('success', 'fail')),
  failed_attempt_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.authorized_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_access_logs ENABLE ROW LEVEL SECURITY;

-- RLS for authorized_users: Admin and Employee can manage
CREATE POLICY "Admins can manage all authorized users"
ON public.authorized_users FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can manage authorized users"
ON public.authorized_users FOR ALL
USING (has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Technicians can view authorized users"
ON public.authorized_users FOR SELECT
USING (has_role(auth.uid(), 'technician'::app_role));

-- RLS for client_access_logs: Admin only can view, staff can insert
CREATE POLICY "Admins can view all access logs"
ON public.client_access_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage access logs"
ON public.client_access_logs FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can insert access logs"
ON public.client_access_logs FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role) OR 
  has_role(auth.uid(), 'technician'::app_role)
);

-- Trigger for updated_at on authorized_users
CREATE TRIGGER update_authorized_users_updated_at
BEFORE UPDATE ON public.authorized_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
