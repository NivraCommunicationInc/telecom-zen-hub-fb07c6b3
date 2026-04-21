-- Add visibility flag to phone inventory so admins can hide phones from public site without deleting them
ALTER TABLE public.phone_inventory
  ADD COLUMN IF NOT EXISTS is_visible_on_site boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_phone_inventory_is_visible_on_site
  ON public.phone_inventory (is_visible_on_site);

-- Tighten the public read policy: anonymous visitors can only see phones that are
-- both 'available' AND flagged visible. Staff/admin policies remain unchanged.
DROP POLICY IF EXISTS "Public can view available phones" ON public.phone_inventory;

CREATE POLICY "Public can view available phones"
  ON public.phone_inventory
  FOR SELECT
  USING (status = 'available' AND is_visible_on_site = true);