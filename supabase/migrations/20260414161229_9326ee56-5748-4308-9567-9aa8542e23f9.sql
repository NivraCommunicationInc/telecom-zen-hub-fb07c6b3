
-- Tighten INSERT policies to require field_sales or admin role

-- field_customer_addresses: only field agents or admins can create
DROP POLICY IF EXISTS "Authenticated users can create addresses" ON public.field_customer_addresses;
CREATE POLICY "Field agents can create addresses" ON public.field_customer_addresses 
  FOR INSERT TO authenticated 
  WITH CHECK (public.is_field_sales(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- address_serviceability_checks: only field agents or admins
DROP POLICY IF EXISTS "Authenticated users can create checks" ON public.address_serviceability_checks;
CREATE POLICY "Field agents can create checks" ON public.address_serviceability_checks 
  FOR INSERT TO authenticated 
  WITH CHECK (public.is_field_sales(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- customer_duplicate_checks: only field agents or admins
DROP POLICY IF EXISTS "Authenticated users can create duplicates" ON public.customer_duplicate_checks;
CREATE POLICY "Field agents can create duplicates" ON public.customer_duplicate_checks 
  FOR INSERT TO authenticated 
  WITH CHECK (public.is_field_sales(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- field_order_status_history: only field agents or admins
DROP POLICY IF EXISTS "Authenticated can create order history" ON public.field_order_status_history;
CREATE POLICY "Field agents can create order history" ON public.field_order_status_history 
  FOR INSERT TO authenticated 
  WITH CHECK (public.is_field_sales(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- field_order_sync_events: only field agents or admins
DROP POLICY IF EXISTS "Authenticated can create sync events" ON public.field_order_sync_events;
CREATE POLICY "Field agents can create sync events" ON public.field_order_sync_events 
  FOR INSERT TO authenticated 
  WITH CHECK (public.is_field_sales(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- field_order_notes: only field agents or admins
DROP POLICY IF EXISTS "Authenticated can create notes" ON public.field_order_notes;
CREATE POLICY "Field agents can create notes" ON public.field_order_notes 
  FOR INSERT TO authenticated 
  WITH CHECK (public.is_field_sales(auth.uid()) OR public.has_role(auth.uid(), 'admin'));
