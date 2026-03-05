
-- MIGRATION 2: Tables, indexes, RLS, triggers, view

-- 1. ORDER_ITEMS
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item_number SMALLINT NOT NULL DEFAULT 1,
  service_type public.order_item_service_type NOT NULL,
  plan_code TEXT,
  plan_name TEXT NOT NULL,
  description TEXT,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  quantity SMALLINT NOT NULL DEFAULT 1,
  line_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  status public.order_item_status NOT NULL DEFAULT 'pending',
  status_reason TEXT,
  status_updated_at TIMESTAMPTZ DEFAULT now(),
  depends_on_item_id UUID REFERENCES public.order_items(id),
  fulfillment_type public.fulfillment_type,
  shipment_id UUID,
  appointment_id UUID REFERENCES public.appointments(id),
  provisioning_job_id UUID,
  service_instance_id UUID REFERENCES public.service_instances(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_id, item_number)
);

-- 2. PROVISIONING_JOBS
CREATE TABLE public.provisioning_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
  service_instance_id UUID REFERENCES public.service_instances(id),
  job_type public.provisioning_job_type NOT NULL,
  job_label TEXT NOT NULL,
  priority SMALLINT NOT NULL DEFAULT 5,
  status public.provisioning_job_status NOT NULL DEFAULT 'queued',
  status_reason TEXT,
  depends_on_job_id UUID REFERENCES public.provisioning_jobs(id),
  attempts SMALLINT NOT NULL DEFAULT 0,
  max_attempts SMALLINT NOT NULL DEFAULT 3,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  result_data JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  error_code TEXT,
  triggered_by UUID,
  triggered_by_role TEXT,
  manual_override_by UUID,
  manual_override_at TIMESTAMPTZ,
  manual_override_reason TEXT,
  execution_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. SHIPMENTS
CREATE TABLE public.shipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES public.order_items(id),
  customer_id UUID,
  shipment_number TEXT UNIQUE,
  carrier TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  status public.shipment_status NOT NULL DEFAULT 'pending',
  ship_to_name TEXT,
  ship_to_address TEXT,
  ship_to_city TEXT,
  ship_to_province TEXT DEFAULT 'QC',
  ship_to_postal_code TEXT,
  ship_to_phone TEXT,
  estimated_ship_date DATE,
  actual_ship_date DATE,
  estimated_delivery_date DATE,
  actual_delivery_date DATE,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. INVENTORY_STOCK
CREATE TABLE public.inventory_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  catalog_item_id UUID REFERENCES public.inventory_items(id),
  item_type public.inventory_stock_type NOT NULL,
  sku TEXT,
  brand TEXT,
  model TEXT,
  serial_number TEXT UNIQUE,
  mac_address TEXT,
  iccid TEXT,
  imei TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  warehouse_location TEXT DEFAULT 'main',
  purchase_date DATE,
  purchase_price NUMERIC(10,2),
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. INVENTORY_ASSIGNMENTS
CREATE TABLE public.inventory_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stock_item_id UUID NOT NULL REFERENCES public.inventory_stock(id),
  order_id UUID NOT NULL REFERENCES public.orders(id),
  order_item_id UUID REFERENCES public.order_items(id),
  shipment_id UUID REFERENCES public.shipments(id),
  customer_id UUID,
  status public.inventory_assignment_status NOT NULL DEFAULT 'reserved',
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID,
  installed_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. FK back-refs
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_provisioning_job_id_fkey FOREIGN KEY (provisioning_job_id) REFERENCES public.provisioning_jobs(id);

-- 7. INDEXES
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_status ON public.order_items(status);
CREATE INDEX idx_provisioning_jobs_order_id ON public.provisioning_jobs(order_id);
CREATE INDEX idx_provisioning_jobs_status ON public.provisioning_jobs(status);
CREATE INDEX idx_provisioning_jobs_depends ON public.provisioning_jobs(depends_on_job_id) WHERE depends_on_job_id IS NOT NULL;
CREATE INDEX idx_shipments_order_id ON public.shipments(order_id);
CREATE INDEX idx_shipments_status ON public.shipments(status);
CREATE INDEX idx_shipments_tracking ON public.shipments(tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX idx_inventory_stock_status ON public.inventory_stock(status);
CREATE INDEX idx_inventory_stock_type ON public.inventory_stock(item_type);
CREATE INDEX idx_inventory_stock_serial ON public.inventory_stock(serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX idx_inventory_assignments_order ON public.inventory_assignments(order_id);
CREATE INDEX idx_inventory_assignments_item ON public.inventory_assignments(stock_item_id);

-- 8. UPDATED_AT TRIGGERS
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_order_items_updated_at BEFORE UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_provisioning_jobs_updated_at BEFORE UPDATE ON public.provisioning_jobs FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_shipments_updated_at BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_inventory_stock_updated_at BEFORE UPDATE ON public.inventory_stock FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
CREATE TRIGGER trg_inventory_assignments_updated_at BEFORE UPDATE ON public.inventory_assignments FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- 9. RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provisioning_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage order_items" ON public.order_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee') OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'sales') OR public.has_role(auth.uid(),'kyc_agent') OR public.has_role(auth.uid(),'billing_admin') OR public.has_role(auth.uid(),'techops') OR public.has_role(auth.uid(),'support'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee') OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'sales') OR public.has_role(auth.uid(),'techops'));

CREATE POLICY "Client can view own order_items" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id=order_items.order_id AND o.user_id=auth.uid()));

CREATE POLICY "Staff can manage provisioning_jobs" ON public.provisioning_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee') OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'techops'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee') OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'techops'));

CREATE POLICY "Staff can manage shipments" ON public.shipments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee') OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'techops') OR public.has_role(auth.uid(),'support'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee') OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'techops'));

CREATE POLICY "Client can view own shipments" ON public.shipments FOR SELECT TO authenticated
  USING (customer_id=auth.uid());

CREATE POLICY "Staff can manage inventory_stock" ON public.inventory_stock FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee') OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'techops'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee') OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'techops'));

CREATE POLICY "Staff can manage inventory_assignments" ON public.inventory_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee') OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'techops'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'employee') OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'techops'));

-- 10. SHIPMENT NUMBER AUTO-GEN
CREATE OR REPLACE FUNCTION public.fn_generate_shipment_number()
RETURNS TRIGGER AS $$
DECLARE seq_num INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(shipment_number FROM 'SHP-\d{4}-(\d+)') AS INT)),0)+1
  INTO seq_num FROM public.shipments WHERE shipment_number LIKE 'SHP-'||TO_CHAR(now(),'YYYY')||'-%';
  NEW.shipment_number := 'SHP-'||TO_CHAR(now(),'YYYY')||'-'||LPAD(seq_num::TEXT,6,'0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_shipment_number BEFORE INSERT ON public.shipments
  FOR EACH ROW WHEN (NEW.shipment_number IS NULL)
  EXECUTE FUNCTION public.fn_generate_shipment_number();

-- 11. NEXT BEST ACTION VIEW
CREATE OR REPLACE VIEW public.order_next_actions AS
SELECT
  o.id AS order_id, o.order_number, o.status, o.id_verification_status, o.payment_status,
  CASE
    WHEN o.id_verification_status IN ('pending','submitted') THEN 'kyc_approve'
    WHEN o.id_verification_status = 'rejected' THEN 'kyc_rejected_action'
    WHEN o.payment_status IN ('pending','failed') THEN 'payment_collect'
    WHEN EXISTS (SELECT 1 FROM public.provisioning_jobs pj WHERE pj.order_id=o.id AND pj.status='failed') THEN 'provisioning_retry'
    WHEN EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id=o.id AND oi.status='fulfillment_pending') THEN 'fulfillment_assign'
    WHEN EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id=o.id AND oi.status='install_scheduled') THEN 'appointment_confirm'
    WHEN EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id=o.id AND oi.status IN ('provisioning_pending','provisioning_in_progress')) THEN 'provisioning_monitor'
    ELSE 'none'
  END AS next_action,
  CASE
    WHEN o.id_verification_status IN ('pending','submitted') THEN 'KYC à approuver'
    WHEN o.id_verification_status = 'rejected' THEN 'KYC rejeté — action requise'
    WHEN o.payment_status IN ('pending','failed') THEN 'Paiement en attente ou échoué'
    WHEN EXISTS (SELECT 1 FROM public.provisioning_jobs pj WHERE pj.order_id=o.id AND pj.status='failed') THEN 'Provisioning échoué — retry'
    WHEN EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id=o.id AND oi.status='fulfillment_pending') THEN 'Équipement à assigner'
    WHEN EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id=o.id AND oi.status='install_scheduled') THEN 'Rendez-vous à confirmer'
    WHEN EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id=o.id AND oi.status IN ('provisioning_pending','provisioning_in_progress')) THEN 'Provisioning en cours'
    ELSE 'Aucune action requise'
  END AS next_action_label,
  (SELECT COUNT(*) FROM public.order_items oi WHERE oi.order_id=o.id) AS total_items,
  (SELECT COUNT(*) FROM public.order_items oi WHERE oi.order_id=o.id AND oi.status='active') AS active_items,
  (SELECT COUNT(*) FROM public.provisioning_jobs pj WHERE pj.order_id=o.id AND pj.status='failed') AS failed_jobs
FROM public.orders o;
