-- Allow public website visitors (anon) to read only active, client-visible banners within time window
-- (Needed for PublicSystemStatusBanner)

ALTER TABLE public.system_status ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Create policy only if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'system_status'
      AND policyname = 'Public can view client-visible system status banners'
  ) THEN
    CREATE POLICY "Public can view client-visible system status banners"
    ON public.system_status
    FOR SELECT
    TO anon
    USING (
      is_active = true
      AND is_banner = true
      AND show_to_clients = true
      AND (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at >= now())
    );
  END IF;
END $$;