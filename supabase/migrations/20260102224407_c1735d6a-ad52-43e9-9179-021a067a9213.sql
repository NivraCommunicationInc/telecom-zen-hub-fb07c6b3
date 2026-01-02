-- Create inventory_items table for equipment/accessories catalog
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'equipment' CHECK (type IN ('equipment', 'accessory')),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  taxable BOOLEAN NOT NULL DEFAULT true,
  sku TEXT,
  requires_serial BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hold', 'inactive')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create equipment_order_lines table for order line items
CREATE TABLE public.equipment_order_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES public.inventory_items(id),
  item_name TEXT NOT NULL,
  item_sku TEXT,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  line_total NUMERIC NOT NULL DEFAULT 0,
  requires_serial BOOLEAN NOT NULL DEFAULT false,
  serial_numbers JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add order_type column to orders table for distinguishing equipment orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'service';

-- Add shipping_address columns for equipment orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_address TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_city TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_province TEXT DEFAULT 'QC';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_postal_code TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS carrier TEXT;

-- Enable RLS on inventory_items
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for inventory_items
CREATE POLICY "Admins can manage inventory items"
  ON public.inventory_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view active inventory items"
  ON public.inventory_items FOR SELECT
  USING (has_role(auth.uid(), 'employee'::app_role) AND status IN ('active', 'hold'));

CREATE POLICY "Anyone can view active inventory items"
  ON public.inventory_items FOR SELECT
  USING (status = 'active');

-- Enable RLS on equipment_order_lines
ALTER TABLE public.equipment_order_lines ENABLE ROW LEVEL SECURITY;

-- RLS policies for equipment_order_lines
CREATE POLICY "Admins can manage equipment order lines"
  ON public.equipment_order_lines FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can manage equipment order lines"
  ON public.equipment_order_lines FOR ALL
  USING (has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Users can view their own order lines"
  ON public.equipment_order_lines FOR SELECT
  USING (order_id IN (SELECT id FROM orders WHERE user_id = auth.uid()));

-- Insert some default inventory items
INSERT INTO public.inventory_items (type, name, description, price, taxable, requires_serial, sku, sort_order) VALUES
('equipment', 'Routeur Wi-Fi 6', 'Routeur haute performance Wi-Fi 6 dual-band', 60.00, true, true, 'RTR-WIFI6-001', 1),
('equipment', 'Décodeur IPTV', 'Décodeur IPTV HD avec télécommande', 50.00, true, true, 'DEC-IPTV-001', 2),
('equipment', 'Téléphone IP', 'Téléphone IP professionnel', 45.00, true, true, 'TEL-IP-001', 3),
('equipment', 'Modem VDSL', 'Modem VDSL2 haute vitesse', 55.00, true, true, 'MDM-VDSL-001', 4),
('accessory', 'Câble Ethernet CAT6 (3m)', 'Câble réseau CAT6 3 mètres', 12.00, true, false, 'CBL-ETH-3M', 10),
('accessory', 'Câble Ethernet CAT6 (5m)', 'Câble réseau CAT6 5 mètres', 15.00, true, false, 'CBL-ETH-5M', 11),
('accessory', 'Câble HDMI (2m)', 'Câble HDMI 2.0 haute qualité', 18.00, true, false, 'CBL-HDMI-2M', 12),
('accessory', 'Télécommande de remplacement', 'Télécommande universelle IPTV', 15.00, true, false, 'REM-UNIV-001', 13),
('accessory', 'Adaptateur secteur', 'Adaptateur secteur 12V', 20.00, true, false, 'PWR-12V-001', 14),
('accessory', 'Support mural routeur', 'Support de montage mural pour routeur', 10.00, true, false, 'MNT-RTR-001', 15);

-- Create trigger for updated_at on inventory_items
CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on equipment_order_lines
CREATE TRIGGER update_equipment_order_lines_updated_at
  BEFORE UPDATE ON public.equipment_order_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();