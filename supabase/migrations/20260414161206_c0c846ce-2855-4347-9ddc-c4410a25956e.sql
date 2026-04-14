
-- ═══════════════════════════════════════════════════════════════════
-- A1 FIELD PORTAL — FOUNDATION SCHEMA EXTENSION
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. COMMERCIAL CATALOG EXTENSIONS ────────────────────────────

-- Versioned pricing: replaces hardcoded fees and mismatched prices
CREATE TABLE public.product_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  price_type text NOT NULL DEFAULT 'recurring_monthly',
  amount numeric(10,2) NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'CAD',
  billing_frequency text,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.product_prices IS 'Versioned pricing for services and equipment. Single source of truth for all prices.';
CREATE INDEX idx_product_prices_service ON public.product_prices(service_id);
CREATE INDEX idx_product_prices_active ON public.product_prices(service_id, status, effective_from);

-- Flexible product attributes (speed, data, channels, etc.)
CREATE TABLE public.product_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  attribute_key text NOT NULL,
  attribute_value jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.product_attributes IS 'Structured attributes for products (download_speed_mbps, data_gb, included_channels, sim_type, etc.)';
CREATE INDEX idx_product_attributes_service ON public.product_attributes(service_id);
CREATE UNIQUE INDEX idx_product_attributes_unique ON public.product_attributes(service_id, attribute_key);

-- Equipment-to-service rules (replaces hardcoded catalog)
CREATE TABLE public.product_equipment_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  equipment_service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  relationship_type text NOT NULL DEFAULT 'optional',
  default_quantity int NOT NULL DEFAULT 1,
  min_quantity int NOT NULL DEFAULT 0,
  max_quantity int NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.product_equipment_rules IS 'Links services to allowed/required equipment with quantity constraints.';
CREATE INDEX idx_equipment_rules_service ON public.product_equipment_rules(service_id);

-- ─── 2. CUSTOMER & ADDRESS DOMAIN ────────────────────────────────

-- Multi-address support
CREATE TABLE public.field_customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid,
  field_lead_id uuid REFERENCES public.field_leads(id) ON DELETE SET NULL,
  address_type text NOT NULL DEFAULT 'service',
  line1 text NOT NULL,
  line2 text,
  city text NOT NULL,
  province_code text NOT NULL DEFAULT 'QC',
  postal_code text NOT NULL,
  country_code text NOT NULL DEFAULT 'CA',
  unit_number text,
  building_code text,
  is_primary boolean NOT NULL DEFAULT true,
  normalized_address text,
  latitude numeric,
  longitude numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.field_customer_addresses IS 'Customer addresses with normalization and coordinates.';
CREATE INDEX idx_fca_customer ON public.field_customer_addresses(customer_id);
CREATE INDEX idx_fca_postal ON public.field_customer_addresses(postal_code);

-- Serviceability check audit trail
CREATE TABLE public.address_serviceability_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address_id uuid REFERENCES public.field_customer_addresses(id) ON DELETE SET NULL,
  raw_input jsonb NOT NULL DEFAULT '{}',
  normalized_address text,
  serviceability_status text NOT NULL DEFAULT 'unknown',
  coverage_type text,
  serviceable_products jsonb DEFAULT '[]',
  restriction_codes text[],
  checked_at timestamptz NOT NULL DEFAULT now(),
  checked_by_user_id uuid,
  source_system text NOT NULL DEFAULT 'field_portal',
  response_payload jsonb DEFAULT '{}'
);
COMMENT ON TABLE public.address_serviceability_checks IS 'Audit trail of every serviceability check with real results.';
CREATE INDEX idx_asc_address ON public.address_serviceability_checks(address_id);
CREATE INDEX idx_asc_status ON public.address_serviceability_checks(serviceability_status);

-- Duplicate detection records
CREATE TABLE public.customer_duplicate_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incoming_customer_hash text NOT NULL,
  matched_customer_id uuid,
  matched_field_lead_id uuid REFERENCES public.field_leads(id) ON DELETE SET NULL,
  match_type text NOT NULL DEFAULT 'phone',
  match_score numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cdc_hash ON public.customer_duplicate_checks(incoming_customer_hash);

-- ─── 3. ORDER ENGINE EXTENSIONS ──────────────────────────────────

-- Order status history (full audit trail)
CREATE TABLE public.field_order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_order_id uuid NOT NULL REFERENCES public.field_sales_orders(id) ON DELETE CASCADE,
  status_domain text NOT NULL DEFAULT 'order',
  old_status text,
  new_status text NOT NULL,
  changed_by_user_id uuid,
  change_reason text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.field_order_status_history IS 'Complete status change audit trail for field orders.';
CREATE INDEX idx_fosh_order ON public.field_order_status_history(field_order_id);
CREATE INDEX idx_fosh_domain ON public.field_order_status_history(field_order_id, status_domain);

-- Sync event tracking (observable and retryable)
CREATE TABLE public.field_order_sync_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_order_id uuid NOT NULL REFERENCES public.field_sales_orders(id) ON DELETE CASCADE,
  sync_target text NOT NULL DEFAULT 'core',
  sync_action text NOT NULL DEFAULT 'create_order',
  sync_status text NOT NULL DEFAULT 'pending',
  attempt_count int NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  next_retry_at timestamptz,
  external_reference text,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.field_order_sync_events IS 'Tracks external/core sync with retry logic.';
CREATE INDEX idx_fose_order ON public.field_order_sync_events(field_order_id);
CREATE INDEX idx_fose_status ON public.field_order_sync_events(sync_status);
CREATE INDEX idx_fose_retry ON public.field_order_sync_events(next_retry_at) WHERE sync_status = 'retrying';

-- Order notes
CREATE TABLE public.field_order_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_order_id uuid NOT NULL REFERENCES public.field_sales_orders(id) ON DELETE CASCADE,
  note_type text NOT NULL DEFAULT 'internal',
  created_by_user_id uuid,
  content text NOT NULL,
  is_internal boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fon_order ON public.field_order_notes(field_order_id);

-- ─── 4. TERRITORY EXTENSIONS ─────────────────────────────────────

-- Master territory records
CREATE TABLE public.field_territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_code text UNIQUE NOT NULL,
  name text NOT NULL,
  city text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Territory assignments
CREATE TABLE public.field_territory_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id uuid NOT NULL REFERENCES public.field_territories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  assigned_from timestamptz NOT NULL DEFAULT now(),
  assigned_to timestamptz,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fta_user ON public.field_territory_assignments(user_id);
CREATE INDEX idx_fta_territory ON public.field_territory_assignments(territory_id);

-- Add territory_id to existing streets table
ALTER TABLE public.field_territory_streets 
  ADD COLUMN IF NOT EXISTS territory_id uuid REFERENCES public.field_territories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS best_hours text,
  ADD COLUMN IF NOT EXISTS access_notes text,
  ADD COLUMN IF NOT EXISTS doors_interested int NOT NULL DEFAULT 0;

-- Territory visit logs
CREATE TABLE public.field_territory_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_street_id uuid NOT NULL REFERENCES public.field_territory_streets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  doors_knocked int NOT NULL DEFAULT 0,
  doors_answered int NOT NULL DEFAULT 0,
  doors_interested int NOT NULL DEFAULT 0,
  doors_sold int NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ftv_street ON public.field_territory_visits(territory_street_id);
CREATE INDEX idx_ftv_user_date ON public.field_territory_visits(user_id, visit_date);

-- ─── 5. LEAD PIPELINE EXTENSIONS ─────────────────────────────────

-- Add missing fields to field_leads
ALTER TABLE public.field_leads
  ADD COLUMN IF NOT EXISTS priority_level text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS lead_stage text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS source_channel text NOT NULL DEFAULT 'door_to_door',
  ADD COLUMN IF NOT EXISTS interest_summary text,
  ADD COLUMN IF NOT EXISTS last_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

-- Lead activities
CREATE TABLE public.field_lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.field_leads(id) ON DELETE CASCADE,
  activity_type text NOT NULL DEFAULT 'note',
  performed_by_user_id uuid NOT NULL,
  notes text,
  activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fla_lead ON public.field_lead_activities(lead_id);

-- Lead tasks / follow-up reminders
CREATE TABLE public.field_lead_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.field_leads(id) ON DELETE CASCADE,
  assigned_user_id uuid NOT NULL,
  task_type text NOT NULL DEFAULT 'follow_up',
  title text NOT NULL,
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_flt_lead ON public.field_lead_tasks(lead_id);
CREATE INDEX idx_flt_user_due ON public.field_lead_tasks(assigned_user_id, due_at) WHERE status = 'pending';

-- ─── 6. COMMISSION ENGINE EXTENSIONS ──────────────────────────────

-- Commission payouts (batch records)
CREATE TABLE public.field_commission_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  payout_period_start date NOT NULL,
  payout_period_end date NOT NULL,
  gross_amount numeric(10,2) NOT NULL DEFAULT 0,
  adjustment_amount numeric(10,2) NOT NULL DEFAULT 0,
  net_amount numeric(10,2) NOT NULL DEFAULT 0,
  payout_status text NOT NULL DEFAULT 'draft',
  paid_at timestamptz,
  reference_number text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fcp_user ON public.field_commission_payouts(user_id);

-- Payout line items
CREATE TABLE public.field_commission_payout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id uuid NOT NULL REFERENCES public.field_commission_payouts(id) ON DELETE CASCADE,
  commission_id uuid NOT NULL,
  amount numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fcpi_payout ON public.field_commission_payout_items(payout_id);

-- ─── 7. OBJECTIVES EXTENSION ──────────────────────────────────────

-- Configurable objective templates (replaces hardcoded targets)
CREATE TABLE public.field_objective_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_code text UNIQUE NOT NULL,
  name text NOT NULL,
  metric_type text NOT NULL DEFAULT 'sales_count',
  default_target_value numeric NOT NULL DEFAULT 0,
  period_type text NOT NULL DEFAULT 'monthly',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── 8. RESOURCES ─────────────────────────────────────────────────

CREATE TABLE public.field_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type text NOT NULL DEFAULT 'document',
  title text NOT NULL,
  description text,
  content_url text,
  content_body text,
  status text NOT NULL DEFAULT 'active',
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- EXPAND commercial_config with more config values
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO public.field_sales_config (config_key, config_value, config_type, description) VALUES
  ('allowed_payment_methods', '["paypal","interac","send_link","card_present"]', 'json', 'Payment methods available in field portal'),
  ('allowed_install_slots', '["09:00-12:00","12:00-15:00","15:00-18:00"]', 'json', 'Available installation time slots'),
  ('default_sales_target', '20', 'number', 'Default monthly sales target for new agents'),
  ('default_revenue_target', '5000', 'number', 'Default monthly revenue target'),
  ('max_router_per_order', '1', 'number', 'Maximum routers per field order'),
  ('max_terminals_per_order', '5', 'number', 'Maximum TV terminals per field order'),
  ('sync_retry_max_attempts', '3', 'number', 'Max sync retry attempts before escalation'),
  ('sync_retry_delay_seconds', '30', 'number', 'Delay between sync retry attempts')
ON CONFLICT (config_key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════

-- product_prices: readable by authenticated
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view active prices" ON public.product_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage prices" ON public.product_prices FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- product_attributes: readable by authenticated
ALTER TABLE public.product_attributes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view attributes" ON public.product_attributes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage attributes" ON public.product_attributes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- product_equipment_rules: readable by authenticated
ALTER TABLE public.product_equipment_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view equipment rules" ON public.product_equipment_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage equipment rules" ON public.product_equipment_rules FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- field_customer_addresses
ALTER TABLE public.field_customer_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view addresses" ON public.field_customer_addresses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create addresses" ON public.field_customer_addresses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can manage addresses" ON public.field_customer_addresses FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- address_serviceability_checks
ALTER TABLE public.address_serviceability_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view checks" ON public.address_serviceability_checks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create checks" ON public.address_serviceability_checks FOR INSERT TO authenticated WITH CHECK (true);

-- customer_duplicate_checks
ALTER TABLE public.customer_duplicate_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view duplicates" ON public.customer_duplicate_checks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create duplicates" ON public.customer_duplicate_checks FOR INSERT TO authenticated WITH CHECK (true);

-- field_order_status_history
ALTER TABLE public.field_order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view order history" ON public.field_order_status_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create order history" ON public.field_order_status_history FOR INSERT TO authenticated WITH CHECK (true);

-- field_order_sync_events
ALTER TABLE public.field_order_sync_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view sync events" ON public.field_order_sync_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create sync events" ON public.field_order_sync_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can manage sync events" ON public.field_order_sync_events FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- field_order_notes
ALTER TABLE public.field_order_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view notes" ON public.field_order_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create notes" ON public.field_order_notes FOR INSERT TO authenticated WITH CHECK (true);

-- field_territories
ALTER TABLE public.field_territories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view territories" ON public.field_territories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage territories" ON public.field_territories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- field_territory_assignments
ALTER TABLE public.field_territory_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view assignments" ON public.field_territory_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage assignments" ON public.field_territory_assignments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- field_territory_visits
ALTER TABLE public.field_territory_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents can view own visits" ON public.field_territory_visits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Agents can create visits" ON public.field_territory_visits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage visits" ON public.field_territory_visits FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- field_lead_activities
ALTER TABLE public.field_lead_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view lead activities" ON public.field_lead_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Agents can create lead activities" ON public.field_lead_activities FOR INSERT TO authenticated WITH CHECK (auth.uid() = performed_by_user_id);

-- field_lead_tasks
ALTER TABLE public.field_lead_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view lead tasks" ON public.field_lead_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Agents can create lead tasks" ON public.field_lead_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = assigned_user_id);
CREATE POLICY "Agents can update own tasks" ON public.field_lead_tasks FOR UPDATE TO authenticated USING (auth.uid() = assigned_user_id);

-- field_commission_payouts
ALTER TABLE public.field_commission_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents can view own payouts" ON public.field_commission_payouts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage payouts" ON public.field_commission_payouts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- field_commission_payout_items
ALTER TABLE public.field_commission_payout_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view payout items" ON public.field_commission_payout_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage payout items" ON public.field_commission_payout_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- field_objective_templates
ALTER TABLE public.field_objective_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view templates" ON public.field_objective_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage templates" ON public.field_objective_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- field_resources
ALTER TABLE public.field_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view resources" ON public.field_resources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage resources" ON public.field_resources FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════════════════════════════
-- ENABLE REALTIME for key field tables
-- ═══════════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE public.field_order_sync_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.field_order_status_history;
