-- Allow all technicians to view all assignments and self-claim unassigned ones
DROP POLICY IF EXISTS tech_assign_self_select ON public.technician_assignments;
DROP POLICY IF EXISTS tech_assign_self_update ON public.technician_assignments;

CREATE POLICY tech_assign_tech_select ON public.technician_assignments
  FOR SELECT
  USING (
    has_role(auth.uid(), 'technician'::app_role)
    OR technician_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'employee'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR has_role(auth.uid(), 'techops'::app_role)
  );

CREATE POLICY tech_assign_tech_update ON public.technician_assignments
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'technician'::app_role)
    OR technician_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'employee'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR has_role(auth.uid(), 'techops'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'technician'::app_role)
    OR technician_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'employee'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR has_role(auth.uid(), 'techops'::app_role)
  );