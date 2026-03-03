
-- Fix overly permissive user_roles policy
DROP POLICY IF EXISTS "Service role can manage all roles" ON public.user_roles;

-- Replace with proper admin-only policy
CREATE POLICY "Admins can manage all roles" ON public.user_roles
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Also fix pdf_generation_logs INSERT policy
DROP POLICY IF EXISTS "System can insert pdf logs" ON public.pdf_generation_logs;
CREATE POLICY "Authenticated can insert pdf logs" ON public.pdf_generation_logs
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
