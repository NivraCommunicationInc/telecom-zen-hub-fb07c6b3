-- AUDIT FIX CP-3 / DB-3: Fix tables with RLS enabled but zero policies.
-- These tables block ALL authenticated access, which is intentional for some,
-- but needs explicit documentation + correct service_role grants.

-- ── email_queue ───────────────────────────────────────────────────────────────
-- Only service_role (edge functions) should read/write the email queue.
-- Authenticated users should never see or modify queue internals directly.

-- Full access for service_role (edge functions use this role)
CREATE POLICY "service_role_full_access_email_queue"
  ON public.email_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can read queue for debugging
CREATE POLICY "admin_read_email_queue"
  ON public.email_queue
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'supervisor', 'techops')
    )
  );

-- ── attendance_records ────────────────────────────────────────────────────────
-- HR data: employees see their own, HR/admin see all.

CREATE POLICY "service_role_full_access_attendance"
  ON public.attendance_records
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "employees_see_own_attendance"
  ON public.attendance_records
  FOR SELECT
  TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'supervisor', 'hr')
    )
  );

CREATE POLICY "hr_admin_manage_attendance"
  ON public.attendance_records
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'supervisor', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'supervisor', 'hr')
    )
  );
