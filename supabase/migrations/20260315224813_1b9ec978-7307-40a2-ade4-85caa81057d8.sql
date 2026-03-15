
-- Day 2: Extend equipment_inventory with address linkage and deployed_at tracking
ALTER TABLE public.equipment_inventory 
  ADD COLUMN IF NOT EXISTS address_id uuid REFERENCES public.service_addresses(id),
  ADD COLUMN IF NOT EXISTS deployed_at timestamptz,
  ADD COLUMN IF NOT EXISTS retired_at timestamptz,
  ADD COLUMN IF NOT EXISTS firmware_version text;

-- Add index for address lookups
CREATE INDEX IF NOT EXISTS idx_equipment_inventory_address_id ON public.equipment_inventory(address_id);

-- Add index for faster status filtering
CREATE INDEX IF NOT EXISTS idx_equipment_inventory_status ON public.equipment_inventory(status);

-- Add index for account lookups
CREATE INDEX IF NOT EXISTS idx_equipment_inventory_account_id ON public.equipment_inventory(account_id);
