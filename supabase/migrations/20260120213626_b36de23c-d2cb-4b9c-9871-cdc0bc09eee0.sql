-- Fix RLS policies to be more restrictive using admin_users table
DROP POLICY IF EXISTS "Admin and employees can view order notes" ON public.order_internal_notes;
DROP POLICY IF EXISTS "Admin and employees can create order notes" ON public.order_internal_notes;

-- Only admins/employees can view order notes
CREATE POLICY "Admin and employees can view order notes"
ON public.order_internal_notes FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
  OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND account_status IN ('admin', 'employee'))
);

-- Only admins/employees can create order notes
CREATE POLICY "Admin and employees can create order notes"
ON public.order_internal_notes FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
  OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND account_status IN ('admin', 'employee'))
);