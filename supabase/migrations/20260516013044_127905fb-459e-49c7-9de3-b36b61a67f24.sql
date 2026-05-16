-- Admins/employees can SELECT all commissions; agents see their own
DROP POLICY IF EXISTS "admins can select all commissions" ON public.field_commissions;
CREATE POLICY "admins can select all commissions"
ON public.field_commissions
FOR SELECT
TO authenticated
USING (
  agent_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
);

-- Admins/employees can UPDATE any commission
DROP POLICY IF EXISTS "admins can update commissions" ON public.field_commissions;
CREATE POLICY "admins can update commissions"
ON public.field_commissions
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
);