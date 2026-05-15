
ALTER TABLE public.hub_store_items
  ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_count INTEGER DEFAULT -1,
  ADD COLUMN IF NOT EXISTS requires_custom_info BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_info_label TEXT,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- hub_orders already has: delivery_address (text), custom_info (jsonb), admin_notes, approved_by, approved_at
-- Convert custom_info jsonb -> text for free-form note (drop & re-add)
ALTER TABLE public.hub_orders
  ADD COLUMN IF NOT EXISTS delivery_name TEXT,
  ADD COLUMN IF NOT EXISTS delivery_city TEXT,
  ADD COLUMN IF NOT EXISTS delivery_province TEXT DEFAULT 'QC',
  ADD COLUMN IF NOT EXISTS delivery_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS delivery_phone TEXT,
  ADD COLUMN IF NOT EXISTS delivery_email TEXT,
  ADD COLUMN IF NOT EXISTS custom_info_text TEXT,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS tracking_url TEXT,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Auto-generate order_number on insert
CREATE OR REPLACE FUNCTION public.hub_orders_set_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'ORD-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hub_orders_order_number ON public.hub_orders;
CREATE TRIGGER trg_hub_orders_order_number
  BEFORE INSERT ON public.hub_orders
  FOR EACH ROW EXECUTE FUNCTION public.hub_orders_set_order_number();

-- Seed standard catalog items (skip if same name+category already exists)
INSERT INTO public.hub_store_items
  (name, category, description, sizes, requires_approval, price, requires_custom_info, custom_info_label, order_index, is_available)
SELECT * FROM (VALUES
  ('T-shirt Nivra', 'uniform', 'T-shirt noir avec logo Nivra brodé au dos', ARRAY['XS','S','M','L','XL','XXL'], true, 0::numeric, false, NULL::text, 1, true),
  ('Polo Nivra', 'uniform', 'Polo professionnel noir avec logo Nivra brodé', ARRAY['XS','S','M','L','XL','XXL'], true, 0::numeric, false, NULL::text, 2, true),
  ('Veste Nivra', 'uniform', 'Veste softshell noire avec logo Nivra', ARRAY['XS','S','M','L','XL','XXL'], true, 0::numeric, false, NULL::text, 3, true),
  ('Manteau Nivra', 'uniform', 'Manteau hiver noir avec logo Nivra brodé', ARRAY['XS','S','M','L','XL','XXL'], true, 0::numeric, false, NULL::text, 4, true),
  ('Badge identification', 'badge', 'Badge avec photo, nom et titre. Délai: 5 jours ouvrables.', NULL::text[], true, 0::numeric, true, 'Titre sur le badge (ex: Agent terrain)', 5, true),
  ('Cartes d''affaires', 'card', 'Boîte de 250 cartes. Nom, titre, courriel, téléphone.', NULL::text[], true, 0::numeric, true, 'Titre sur les cartes (ex: Agent terrain Nivra)', 6, true),
  ('Sac de présentation Nivra', 'accessory', 'Sac avec logo pour présenter les forfaits aux clients.', NULL::text[], true, 0::numeric, false, NULL::text, 7, true),
  ('Support tablette', 'accessory', 'Support réglable universel pour iPad et tablette.', NULL::text[], true, 0::numeric, false, NULL::text, 8, true)
) AS v(name, category, description, sizes, requires_approval, price, requires_custom_info, custom_info_label, order_index, is_available)
WHERE NOT EXISTS (
  SELECT 1 FROM public.hub_store_items s WHERE s.name = v.name AND s.category = v.category
);
