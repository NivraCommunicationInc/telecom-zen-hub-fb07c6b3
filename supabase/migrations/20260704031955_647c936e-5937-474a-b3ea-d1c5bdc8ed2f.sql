DROP POLICY IF EXISTS "Core roles can manage service addresses" ON public.service_addresses;
CREATE POLICY "Core roles can manage service addresses"
  ON public.service_addresses
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'employee'::app_role)
    OR public.has_role(auth.uid(), 'support'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_role(auth.uid(), 'ops'::app_role)
    OR public.has_role(auth.uid(), 'billing_admin'::app_role)
    OR public.has_role(auth.uid(), 'techops'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'employee'::app_role)
    OR public.has_role(auth.uid(), 'support'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_role(auth.uid(), 'ops'::app_role)
    OR public.has_role(auth.uid(), 'billing_admin'::app_role)
    OR public.has_role(auth.uid(), 'techops'::app_role)
  );