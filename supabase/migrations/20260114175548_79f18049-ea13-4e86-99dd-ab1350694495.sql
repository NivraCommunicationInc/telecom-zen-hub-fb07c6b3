-- Fix Marketing Email RLS: allow staff based on user_roles (has_role)
-- Root cause: admin UI validates admins via public.user_roles, but marketing tables policies only checked admin_users/employees.

-- Helper expression replicated in each policy:
-- (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee') OR exists in admin_users/employees as active)

-- =========================
-- email_templates
-- =========================
DROP POLICY IF EXISTS "Admin can manage email_templates" ON public.email_templates;
CREATE POLICY "Staff can manage email_templates"
ON public.email_templates
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
  OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
  OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND is_active = true)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
  OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
  OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND is_active = true)
);

-- =========================
-- email_campaigns
-- =========================
DROP POLICY IF EXISTS "Admin can manage email_campaigns" ON public.email_campaigns;
CREATE POLICY "Staff can manage email_campaigns"
ON public.email_campaigns
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
  OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
  OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND is_active = true)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
  OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
  OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND is_active = true)
);

-- =========================
-- email_automation_rules
-- =========================
DROP POLICY IF EXISTS "Admin can manage email_automation_rules" ON public.email_automation_rules;
CREATE POLICY "Staff can manage email_automation_rules"
ON public.email_automation_rules
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
  OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
  OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND is_active = true)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
  OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
  OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND is_active = true)
);

-- =========================
-- email_sends (read/ops table)
-- =========================
DROP POLICY IF EXISTS "Admin can view email_sends" ON public.email_sends;
CREATE POLICY "Staff can view email_sends"
ON public.email_sends
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
  OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
  OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND is_active = true)
);

-- =========================
-- email_unsubscribes
-- =========================
DROP POLICY IF EXISTS "Admin can manage email_unsubscribes" ON public.email_unsubscribes;
CREATE POLICY "Staff can manage email_unsubscribes"
ON public.email_unsubscribes
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
  OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
  OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND is_active = true)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
  OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
  OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND is_active = true)
);

-- =========================
-- client_email_preferences (staff manage)
-- =========================
DROP POLICY IF EXISTS "Admin can manage client_email_preferences" ON public.client_email_preferences;
CREATE POLICY "Staff can manage client_email_preferences"
ON public.client_email_preferences
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
  OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
  OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND is_active = true)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
  OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
  OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND is_active = true)
);
