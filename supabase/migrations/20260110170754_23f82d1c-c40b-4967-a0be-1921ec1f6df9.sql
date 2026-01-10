-- FIX SECURITY: Replace permissive "USING (true)" policies with proper admin role checks

-- Drop overly permissive policies and replace with role-based access

-- SERVICE INSTANCES
DROP POLICY IF EXISTS "Admins can manage service instances" ON public.service_instances;
CREATE POLICY "Staff can manage service instances" ON public.service_instances
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'employee')
    )
  );

-- MOBILE FULFILLMENT
DROP POLICY IF EXISTS "Admins can manage mobile fulfillment" ON public.mobile_fulfillment;
CREATE POLICY "Staff can manage mobile fulfillment" ON public.mobile_fulfillment
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'employee')
    )
  );

-- STREAMING ACTIVATION TOKENS
DROP POLICY IF EXISTS "Admins can manage streaming tokens" ON public.streaming_activation_tokens;
CREATE POLICY "Staff can manage streaming tokens" ON public.streaming_activation_tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'employee')
    )
  );