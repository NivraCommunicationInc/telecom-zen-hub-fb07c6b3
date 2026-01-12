-- =====================================================
-- SECURITY FIX: Enable RLS on exposed tables/views
-- =====================================================

-- 1. Admin Audit Logs - Admin only access
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_log;
CREATE POLICY "Admins can view audit logs" ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.admin_audit_log;
CREATE POLICY "Admins can insert audit logs" ON public.admin_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

-- 2. Admin Auth Audit Log - Admin only
ALTER TABLE public.admin_auth_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view auth audit logs" ON public.admin_auth_audit_log;
CREATE POLICY "Admins can view auth audit logs" ON public.admin_auth_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "System can insert auth audit logs" ON public.admin_auth_audit_log;
CREATE POLICY "System can insert auth audit logs" ON public.admin_auth_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 3. Admin Security Audit - Admin only
ALTER TABLE public.admin_security_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view security audit" ON public.admin_security_audit;
CREATE POLICY "Admins can view security audit" ON public.admin_security_audit
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "System can insert security audit" ON public.admin_security_audit;
CREATE POLICY "System can insert security audit" ON public.admin_security_audit
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 4. Client Access Logs - Admin/Employee only
ALTER TABLE public.client_access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view client access logs" ON public.client_access_logs;
CREATE POLICY "Staff can view client access logs" ON public.client_access_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

DROP POLICY IF EXISTS "Staff can insert client access logs" ON public.client_access_logs;
CREATE POLICY "Staff can insert client access logs" ON public.client_access_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

-- 5. Client Activity Logs - Admin/Employee can view all, Clients own data
ALTER TABLE public.client_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view all client activity" ON public.client_activity_logs;
CREATE POLICY "Staff can view all client activity" ON public.client_activity_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

DROP POLICY IF EXISTS "Clients can view own activity" ON public.client_activity_logs;
CREATE POLICY "Clients can view own activity" ON public.client_activity_logs
  FOR SELECT TO authenticated
  USING (client_id = auth.uid());

DROP POLICY IF EXISTS "Staff can insert client activity" ON public.client_activity_logs;
CREATE POLICY "Staff can insert client activity" ON public.client_activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 6. Contact Requests - Admin/Employee only
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage contact requests" ON public.contact_requests;
CREATE POLICY "Staff can manage contact requests" ON public.contact_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

DROP POLICY IF EXISTS "Public can submit contact requests" ON public.contact_requests;
CREATE POLICY "Public can submit contact requests" ON public.contact_requests
  FOR INSERT TO anon
  WITH CHECK (true);

-- 7. Contest Entries - Admin can view all, Users own entries
ALTER TABLE public.contest_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all contest entries" ON public.contest_entries;
CREATE POLICY "Admins can view all contest entries" ON public.contest_entries
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

DROP POLICY IF EXISTS "Users can view own contest entries" ON public.contest_entries;
CREATE POLICY "Users can view own contest entries" ON public.contest_entries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own contest entries" ON public.contest_entries;
CREATE POLICY "Users can insert own contest entries" ON public.contest_entries
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 8. Accounts - Admin/Employee can view all, Clients own accounts
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage all accounts" ON public.accounts;
CREATE POLICY "Staff can manage all accounts" ON public.accounts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

DROP POLICY IF EXISTS "Clients can view own accounts" ON public.accounts;
CREATE POLICY "Clients can view own accounts" ON public.accounts
  FOR SELECT TO authenticated
  USING (client_id = auth.uid());

-- 9. Orders - Admin/Employee can view all, Clients own orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage all orders" ON public.orders;
CREATE POLICY "Staff can manage all orders" ON public.orders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

DROP POLICY IF EXISTS "Clients can view own orders" ON public.orders;
CREATE POLICY "Clients can view own orders" ON public.orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Clients can insert own orders" ON public.orders;
CREATE POLICY "Clients can insert own orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 10. Billing - Admin/Employee can view all, Clients own billing
ALTER TABLE public.billing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage all billing" ON public.billing;
CREATE POLICY "Staff can manage all billing" ON public.billing
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

DROP POLICY IF EXISTS "Clients can view own billing" ON public.billing;
CREATE POLICY "Clients can view own billing" ON public.billing
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 11. Profiles - Admin/Employee can view all, Users own profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;
CREATE POLICY "Staff can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
CREATE POLICY "Users can manage own profile" ON public.profiles
  FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 12. Activity Logs - Admin/Employee only
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view activity logs" ON public.activity_logs;
CREATE POLICY "Staff can view activity logs" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

DROP POLICY IF EXISTS "Staff can insert activity logs" ON public.activity_logs;
CREATE POLICY "Staff can insert activity logs" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);