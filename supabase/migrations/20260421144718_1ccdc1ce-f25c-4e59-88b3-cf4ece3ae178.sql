-- Harden public RLS for phone_inventory: explicit, deny-by-default for anonymous
-- Drop and recreate the public read policy with stricter wording and roles.
DROP POLICY IF EXISTS "Public can view available phones" ON public.phone_inventory;

CREATE POLICY "Public can view available visible phones"
  ON public.phone_inventory
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'available'
    AND is_visible_on_site = true
  );

-- Performance index for the public catalog query (status + visibility)
CREATE INDEX IF NOT EXISTS idx_phone_inventory_public_visible
  ON public.phone_inventory (status, is_visible_on_site)
  WHERE status = 'available' AND is_visible_on_site = true;

-- Ensure realtime broadcasts row changes so clients can invalidate caches
ALTER TABLE public.phone_inventory REPLICA IDENTITY FULL;

-- Add to realtime publication if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'phone_inventory'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.phone_inventory';
  END IF;
END $$;