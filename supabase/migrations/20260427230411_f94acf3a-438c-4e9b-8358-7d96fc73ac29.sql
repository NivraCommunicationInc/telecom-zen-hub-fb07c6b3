-- Lock down internal Field/operational tables: replace USING(true) authenticated SELECT
-- with staff-only role checks (admin, employee, supervisor, field_sales).
-- Public catalogs (tv_packs, product_*, service_coverage_areas, referral_program_settings,
-- stripe_plan_mapping) are intentionally left readable.

-- Helper predicate: any internal staff
-- (has_role checks are existing security definer functions, no recursion risk)

-- field_commission_payout_items
DROP POLICY IF EXISTS "Authenticated can view payout items" ON public.field_commission_payout_items;
CREATE POLICY "Staff can view payout items"
ON public.field_commission_payout_items FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'field_sales'::app_role)
);

-- field_customer_addresses
DROP POLICY IF EXISTS "Authenticated users can view addresses" ON public.field_customer_addresses;
CREATE POLICY "Staff can view field customer addresses"
ON public.field_customer_addresses FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'field_sales'::app_role)
);

-- field_lead_activities
DROP POLICY IF EXISTS "Authenticated can view lead activities" ON public.field_lead_activities;
CREATE POLICY "Staff can view lead activities"
ON public.field_lead_activities FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'field_sales'::app_role)
);

-- field_lead_tasks
DROP POLICY IF EXISTS "Authenticated can view lead tasks" ON public.field_lead_tasks;
CREATE POLICY "Staff can view lead tasks"
ON public.field_lead_tasks FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'field_sales'::app_role)
);

-- field_objective_templates
DROP POLICY IF EXISTS "Authenticated can view templates" ON public.field_objective_templates;
CREATE POLICY "Staff can view objective templates"
ON public.field_objective_templates FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'field_sales'::app_role)
);

-- field_order_notes
DROP POLICY IF EXISTS "Authenticated can view notes" ON public.field_order_notes;
CREATE POLICY "Staff can view field order notes"
ON public.field_order_notes FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'field_sales'::app_role)
);

-- field_order_status_history
DROP POLICY IF EXISTS "Authenticated can view order history" ON public.field_order_status_history;
CREATE POLICY "Staff can view field order history"
ON public.field_order_status_history FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'field_sales'::app_role)
);

-- field_order_sync_events
DROP POLICY IF EXISTS "Authenticated can view sync events" ON public.field_order_sync_events;
CREATE POLICY "Staff can view sync events"
ON public.field_order_sync_events FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'field_sales'::app_role)
);

-- field_resources
DROP POLICY IF EXISTS "Authenticated can view resources" ON public.field_resources;
CREATE POLICY "Staff can view field resources"
ON public.field_resources FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'field_sales'::app_role)
);

-- field_sales_promotions
DROP POLICY IF EXISTS "authenticated_read_field_promos" ON public.field_sales_promotions;
CREATE POLICY "Staff can view field promotions"
ON public.field_sales_promotions FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'field_sales'::app_role)
);

-- field_territories
DROP POLICY IF EXISTS "Authenticated can view territories" ON public.field_territories;
CREATE POLICY "Staff can view territories"
ON public.field_territories FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'field_sales'::app_role)
);

-- field_territory_assignments
DROP POLICY IF EXISTS "Authenticated can view assignments" ON public.field_territory_assignments;
CREATE POLICY "Staff can view territory assignments"
ON public.field_territory_assignments FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'field_sales'::app_role)
);

-- field_territory_visits
DROP POLICY IF EXISTS "Agents can view own visits" ON public.field_territory_visits;
CREATE POLICY "Staff can view territory visits"
ON public.field_territory_visits FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'field_sales'::app_role)
);

-- assignment_rules
DROP POLICY IF EXISTS "Staff can read assignment rules" ON public.assignment_rules;
CREATE POLICY "Staff can read assignment rules"
ON public.assignment_rules FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'field_sales'::app_role)
);

-- technician_slots
DROP POLICY IF EXISTS "Authenticated can view slots" ON public.technician_slots;
CREATE POLICY "Staff can view technician slots"
ON public.technician_slots FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'field_sales'::app_role)
);

-- customer_duplicate_checks
DROP POLICY IF EXISTS "Authenticated users can view duplicates" ON public.customer_duplicate_checks;
CREATE POLICY "Staff can view duplicate checks"
ON public.customer_duplicate_checks FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'field_sales'::app_role)
);

-- address_serviceability_checks
DROP POLICY IF EXISTS "Authenticated users can view checks" ON public.address_serviceability_checks;
CREATE POLICY "Staff can view serviceability checks"
ON public.address_serviceability_checks FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'field_sales'::app_role)
);
