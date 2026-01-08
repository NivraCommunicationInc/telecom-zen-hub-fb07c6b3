-- ============================================
-- FIX: RLS Enabled No Policy - Add policies to missing tables
-- ============================================

-- rate_limit_attempts: Service role only (edge functions manage this)
CREATE POLICY "Service role manages rate limit attempts" 
ON public.rate_limit_attempts 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- rate_limit_lockouts: Service role only (edge functions manage this)
CREATE POLICY "Service role manages rate limit lockouts" 
ON public.rate_limit_lockouts 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- security_incidents: Admins can read, service role can insert
CREATE POLICY "Admins can view security incidents" 
ON public.security_incidents 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role inserts security incidents" 
ON public.security_incidents 
FOR INSERT 
TO service_role
WITH CHECK (true);