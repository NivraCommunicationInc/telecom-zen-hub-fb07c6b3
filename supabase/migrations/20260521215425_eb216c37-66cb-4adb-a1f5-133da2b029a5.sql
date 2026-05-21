CREATE OR REPLACE FUNCTION public.tech_can_access_order(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'technician')
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'employee')
      OR public.has_role(auth.uid(), 'supervisor')
      OR public.has_role(auth.uid(), 'techops')
    )
    AND EXISTS (
      SELECT 1
      FROM public.technician_assignments ta
      WHERE ta.order_id = p_order_id
    );
$$;

REVOKE ALL ON FUNCTION public.tech_can_access_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tech_can_access_order(uuid) TO authenticated;

DROP POLICY IF EXISTS tech_read_orders_for_assignments ON public.orders;
CREATE POLICY tech_read_orders_for_assignments
ON public.orders
FOR SELECT
TO authenticated
USING (public.tech_can_access_order(id));

DROP POLICY IF EXISTS tech_read_order_items_for_assignments ON public.order_items;
CREATE POLICY tech_read_order_items_for_assignments
ON public.order_items
FOR SELECT
TO authenticated
USING (public.tech_can_access_order(order_id));

DROP POLICY IF EXISTS tech_read_appointments_for_assignments ON public.appointments;
CREATE POLICY tech_read_appointments_for_assignments
ON public.appointments
FOR SELECT
TO authenticated
USING (public.tech_can_access_order(order_id));

DROP POLICY IF EXISTS tech_read_equipment_inventory ON public.equipment_inventory;
CREATE POLICY tech_read_equipment_inventory
ON public.equipment_inventory
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'technician')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'employee')
  OR public.has_role(auth.uid(), 'supervisor')
  OR public.has_role(auth.uid(), 'techops')
);