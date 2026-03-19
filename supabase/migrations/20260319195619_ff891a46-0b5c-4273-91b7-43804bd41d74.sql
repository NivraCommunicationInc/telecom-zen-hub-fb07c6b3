
-- Add portal access flags to user_roles table
-- These control which internal portals each staff member can access
ALTER TABLE public.user_roles 
  ADD COLUMN IF NOT EXISTS can_access_core boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_access_employee boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_access_field boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_access_technician boolean NOT NULL DEFAULT false;

-- Grant admin roles full access by default
UPDATE public.user_roles 
SET can_access_core = true, 
    can_access_employee = true, 
    can_access_field = true, 
    can_access_technician = true 
WHERE role = 'admin';

-- Grant employees access to employee portal by default
UPDATE public.user_roles 
SET can_access_employee = true 
WHERE role = 'employee';

-- Grant technicians access to technician portal by default
UPDATE public.user_roles 
SET can_access_technician = true 
WHERE role = 'technician';

-- Grant field_sales access to field portal by default
UPDATE public.user_roles 
SET can_access_field = true 
WHERE role = 'field_sales';

-- Create a security definer function to check portal access
CREATE OR REPLACE FUNCTION public.check_portal_access(_user_id uuid, _portal text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND status = 'active'
      AND is_active = true
      AND CASE _portal
        WHEN 'core' THEN can_access_core
        WHEN 'employee' THEN can_access_employee
        WHEN 'field' THEN can_access_field
        WHEN 'technician' THEN can_access_technician
        ELSE false
      END
  )
$$;

-- Create login audit table for the hub
CREATE TABLE IF NOT EXISTS public.hub_login_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text,
  portal_accessed text,
  ip_address text,
  user_agent text,
  event text NOT NULL DEFAULT 'login',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_login_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can read hub login audit
CREATE POLICY "Admins can read hub_login_audit"
  ON public.hub_login_audit
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Authenticated staff can insert their own login records
CREATE POLICY "Staff can insert own hub_login_audit"
  ON public.hub_login_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
