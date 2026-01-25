-- Fix staff role functions to use user_roles table instead of staff_roles
-- This resolves the mismatch where employee accounts exist in user_roles but RPCs check staff_roles

-- Drop existing functions with CASCADE to remove dependent policies
DROP FUNCTION IF EXISTS public.get_user_staff_roles(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.has_staff_role(uuid, staff_role) CASCADE;

-- Recreate has_staff_role to use user_roles with app_role type
CREATE OR REPLACE FUNCTION public.has_staff_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND is_active = true
      AND status = 'active'
  )
$$;

-- Recreate get_user_staff_roles to use user_roles returning app_role[]
CREATE OR REPLACE FUNCTION public.get_user_staff_roles(_user_id UUID)
RETURNS app_role[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(role), ARRAY[]::app_role[])
  FROM public.user_roles
  WHERE user_id = _user_id
    AND role IN ('admin', 'employee', 'technician')
    AND is_active = true
    AND status = 'active'
$$;

-- Recreate the dropped policy for staff_roles table
CREATE POLICY "Admins can manage all staff roles" 
ON public.staff_roles 
FOR ALL 
USING (public.has_staff_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_staff_role(auth.uid(), 'admin'::app_role));