-- Allow employees to read their own sales_targets when employee_id stores auth.uid() directly
-- (Core writes employee_id = auth user_id; existing policy only matched employee_records.id)
DROP POLICY IF EXISTS "Employees view own sales_targets" ON public.sales_targets;

CREATE POLICY "Employees view own sales_targets"
  ON public.sales_targets FOR SELECT
  TO authenticated
  USING (
    employee_id = auth.uid()
    OR employee_id IN (SELECT id FROM public.employee_records WHERE user_id = auth.uid())
  );