-- ============================================
-- FIX: Add proper RLS policies for remaining sensitive tables
-- ============================================

-- activity_logs: Block anon, restrict to admins
DROP POLICY IF EXISTS "Deny anonymous access to activity_logs" ON public.activity_logs;
CREATE POLICY "Deny anonymous access to activity_logs" 
ON public.activity_logs FOR ALL TO anon USING (false);

-- Verify staff can view activity logs
CREATE POLICY "Staff can view activity logs" 
ON public.activity_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'employee'::app_role));

-- client_activity_logs: Block anon, staff read only
DROP POLICY IF EXISTS "Deny anonymous access to client_activity_logs" ON public.client_activity_logs;
CREATE POLICY "Deny anonymous access to client_activity_logs" 
ON public.client_activity_logs FOR ALL TO anon USING (false);

-- Staff can view client activity logs
CREATE POLICY "Staff can view client activity logs" 
ON public.client_activity_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'employee'::app_role));

-- client_internal_notes: Block anon, staff only
DROP POLICY IF EXISTS "Deny anonymous access to client_internal_notes" ON public.client_internal_notes;
CREATE POLICY "Deny anonymous access to client_internal_notes" 
ON public.client_internal_notes FOR ALL TO anon USING (false);

-- Staff can view client internal notes  
CREATE POLICY "Staff can view client internal notes" 
ON public.client_internal_notes FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'employee'::app_role));

-- Staff can create client internal notes
CREATE POLICY "Staff can create client internal notes" 
ON public.client_internal_notes FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'employee'::app_role));