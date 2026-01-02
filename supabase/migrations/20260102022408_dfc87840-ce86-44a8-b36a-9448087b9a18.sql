-- Fix RLS policy for client_access_logs INSERT
-- Allow inserts from authenticated users OR from edge functions using service role

-- Drop the existing insert policy
DROP POLICY IF EXISTS "Staff can insert access logs" ON public.client_access_logs;

-- Create a more permissive insert policy
-- This allows inserts when either:
-- 1. The user has a valid role via has_role function, OR
-- 2. The insert is done via edge function (staff_user_id is provided and non-null)
CREATE POLICY "Staff can insert access logs"
ON public.client_access_logs
FOR INSERT
WITH CHECK (
  -- Allow if authenticated user has a staff role
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role) OR 
  has_role(auth.uid(), 'technician'::app_role) OR
  -- Also allow if staff_user_id is provided (for employee portal via edge functions)
  (staff_user_id IS NOT NULL AND staff_name IS NOT NULL)
);

-- Also fix client_activity_logs INSERT policy
DROP POLICY IF EXISTS "Staff can insert client activity logs" ON public.client_activity_logs;

CREATE POLICY "Staff can insert client activity logs"
ON public.client_activity_logs
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'employee'::app_role) OR 
  has_role(auth.uid(), 'technician'::app_role) OR
  -- Allow if actor info is provided (for employee portal via edge functions)
  (actor_user_id IS NOT NULL AND actor_name IS NOT NULL)
);