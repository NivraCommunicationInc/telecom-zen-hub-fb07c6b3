
DROP POLICY IF EXISTS "Staff can insert account adjustments" ON public.account_adjustments;
CREATE POLICY "Staff can insert account adjustments"
ON public.account_adjustments
FOR INSERT TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  AND NOT (coalesce(metadata, '{}'::jsonb) ? 'compensation')
);
