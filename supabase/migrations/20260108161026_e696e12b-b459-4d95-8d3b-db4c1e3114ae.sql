-- ============================================
-- CRITICAL FIX: Block anonymous access - channel_selections
-- ============================================

-- channel_selections: Block anon access
DROP POLICY IF EXISTS "Deny anonymous access to channel_selections" ON public.channel_selections;
CREATE POLICY "Deny anonymous access to channel_selections" 
ON public.channel_selections 
FOR ALL 
TO anon
USING (false);

-- Comment documenting the security pattern
COMMENT ON SCHEMA public IS 'All sensitive tables have explicit DENY policies for anon role. Only authenticated users can access data through proper RLS policies.';