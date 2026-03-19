
-- Tighten RLS policies to require staff role via has_role or user_roles check
-- Drop overly permissive policies and replace with role-gated ones

DROP POLICY IF EXISTS "Staff can read work items" ON public.employee_work_items;
DROP POLICY IF EXISTS "Staff can update work items" ON public.employee_work_items;
DROP POLICY IF EXISTS "System can insert work items" ON public.employee_work_items;
DROP POLICY IF EXISTS "System can insert notifications" ON public.employee_notifications;

-- Work items: only staff with employee portal access
CREATE POLICY "Staff read work items" ON public.employee_work_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND status = 'active'
      AND is_active = true
      AND can_access_employee = true
    )
  );

CREATE POLICY "Staff update work items" ON public.employee_work_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND status = 'active'
      AND is_active = true
      AND can_access_employee = true
    )
  );

CREATE POLICY "Staff insert work items" ON public.employee_work_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND status = 'active'
      AND is_active = true
    )
  );

-- Notifications: insert is service-level (any authenticated staff)
CREATE POLICY "Staff insert notifications" ON public.employee_notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND status = 'active'
      AND is_active = true
    )
  );
