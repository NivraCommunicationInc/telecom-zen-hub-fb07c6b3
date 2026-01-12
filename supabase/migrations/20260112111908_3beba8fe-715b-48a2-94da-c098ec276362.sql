-- Fix overly permissive INSERT policies for audit logs
-- These tables need to allow inserts from authenticated users but
-- using auth.uid() to ensure they're actually authenticated

-- 1. Fix admin_auth_audit_log INSERT policy
DROP POLICY IF EXISTS "System can insert auth audit logs" ON public.admin_auth_audit_log;
CREATE POLICY "Authenticated can insert auth audit logs" ON public.admin_auth_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Fix admin_security_audit INSERT policy
DROP POLICY IF EXISTS "System can insert security audit" ON public.admin_security_audit;
CREATE POLICY "Authenticated can insert security audit" ON public.admin_security_audit
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Fix client_activity_logs INSERT policy
DROP POLICY IF EXISTS "Staff can insert client activity" ON public.client_activity_logs;
CREATE POLICY "Authenticated can insert client activity" ON public.client_activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Fix activity_logs INSERT policy
DROP POLICY IF EXISTS "Staff can insert activity logs" ON public.activity_logs;
CREATE POLICY "Authenticated can insert activity logs" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);