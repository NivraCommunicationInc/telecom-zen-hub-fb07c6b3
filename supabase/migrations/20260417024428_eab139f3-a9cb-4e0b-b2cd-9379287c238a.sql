-- 1) Make maintenance + announcement settings publicly readable
UPDATE public.site_settings
SET is_public = true
WHERE key IN ('maintenance_mode', 'maintenance_allowed_routes', 'quick_announcement');

-- 2) Reset allowed routes so the homepage "/" is NOT exempt during maintenance
UPDATE public.site_settings
SET value_json = jsonb_build_object(
  'routes', ARRAY['/status', '/contact', '/portal/auth']
)
WHERE key = 'maintenance_allowed_routes';

-- 3) Ensure an explicit public-read RLS policy exists for is_public = true rows
DROP POLICY IF EXISTS "public_read_public_settings" ON public.site_settings;
CREATE POLICY "public_read_public_settings"
ON public.site_settings
FOR SELECT
TO anon, authenticated
USING (is_public = true);