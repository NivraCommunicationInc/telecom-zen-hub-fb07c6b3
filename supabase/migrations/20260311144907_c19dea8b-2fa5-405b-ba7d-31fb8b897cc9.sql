
-- Equipment inventory table for real stock management
CREATE TABLE public.equipment_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Catalog reference
  catalog_item_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  catalog_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Équipement',
  sku TEXT,
  -- Identity
  serial_number TEXT UNIQUE,
  imei TEXT,
  mac_address TEXT,
  -- Pricing
  cost_internal NUMERIC(10,2) DEFAULT 0,
  price_client NUMERIC(10,2) DEFAULT 0,
  -- Status: in_stock, reserved, assigned, returned, defective, lost
  status TEXT NOT NULL DEFAULT 'in_stock',
  -- Assignments
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  subscription_id UUID,
  assigned_at TIMESTAMPTZ,
  assigned_by UUID,
  -- Metadata
  notes TEXT,
  condition TEXT DEFAULT 'new',
  warehouse_location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for stock queries
CREATE INDEX idx_equipment_inventory_status ON public.equipment_inventory(status);
CREATE INDEX idx_equipment_inventory_serial ON public.equipment_inventory(serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX idx_equipment_inventory_account ON public.equipment_inventory(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX idx_equipment_inventory_order ON public.equipment_inventory(order_id) WHERE order_id IS NOT NULL;

-- RLS
ALTER TABLE public.equipment_inventory ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (admin/staff) full access
CREATE POLICY "Authenticated users can manage equipment inventory"
  ON public.equipment_inventory
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Equipment audit log
CREATE TABLE public.equipment_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID REFERENCES public.equipment_inventory(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  actor_id UUID,
  actor_name TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage equipment audit"
  ON public.equipment_audit_log
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Auto update updated_at
CREATE OR REPLACE FUNCTION public.update_equipment_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_equipment_inventory_updated_at
  BEFORE UPDATE ON public.equipment_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_equipment_inventory_updated_at();
