-- 1. FIX maintenance_mode (was stored as text "yes" instead of JSON)
UPDATE public.site_settings
SET value_json = jsonb_build_object(
  'enabled', false,
  'eta', null,
  'message_fr', 'Nous effectuons une maintenance planifiée. Le service sera rétabli sous peu.',
  'message_en', 'We are performing scheduled maintenance. Service will be restored shortly.'
),
value_text = null
WHERE key = 'maintenance_mode';

-- Ensure maintenance_mode exists (in case row missing)
INSERT INTO public.site_settings (key, value_json, is_public)
SELECT 'maintenance_mode',
  jsonb_build_object(
    'enabled', false,
    'eta', null,
    'message_fr', 'Nous effectuons une maintenance planifiée. Le service sera rétabli sous peu.',
    'message_en', 'We are performing scheduled maintenance. Service will be restored shortly.'
  ),
  true
WHERE NOT EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'maintenance_mode');

-- Ensure maintenance_allowed_routes exists with sane defaults
INSERT INTO public.site_settings (key, value_json, is_public)
SELECT 'maintenance_allowed_routes',
  jsonb_build_object('routes', ARRAY['/', '/contact', '/aide', '/portal/auth', '/status']),
  true
WHERE NOT EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'maintenance_allowed_routes');

-- 2. NEW: quick_announcement (global hybrid announcement key)
INSERT INTO public.site_settings (key, value_json, is_public)
SELECT 'quick_announcement',
  jsonb_build_object(
    'active', false,
    'message_fr', '',
    'message_en', '',
    'type', 'info',
    'link', '',
    'link_text_fr', '',
    'link_text_en', ''
  ),
  true
WHERE NOT EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'quick_announcement');

-- 3. service_status — add missing columns
ALTER TABLE public.service_status
  ADD COLUMN IF NOT EXISTS incident_message text,
  ADD COLUMN IF NOT EXISTS estimated_resolution timestamptz;
-- updated_by column already exists per audit

-- 4. NEW: service_incidents (history)
CREATE TABLE IF NOT EXISTS public.service_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL,
  service_display_name text,
  status_at_incident text NOT NULL,
  incident_title text NOT NULL,
  incident_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  duration_minutes integer GENERATED ALWAYS AS (
    CASE WHEN resolved_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (resolved_at - started_at))::integer / 60
      ELSE NULL END
  ) STORED,
  resolved_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view resolved incident history" ON public.service_incidents;
CREATE POLICY "Public can view resolved incident history"
  ON public.service_incidents FOR SELECT
  USING (resolved_at IS NOT NULL);

DROP POLICY IF EXISTS "Staff can view all incidents" ON public.service_incidents;
CREATE POLICY "Staff can view all incidents"
  ON public.service_incidents FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'employee'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
  );

DROP POLICY IF EXISTS "Admins can manage incidents" ON public.service_incidents;
CREATE POLICY "Admins can manage incidents"
  ON public.service_incidents FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_service_incidents_started_at
  ON public.service_incidents (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_incidents_service
  ON public.service_incidents (service_name);

DROP TRIGGER IF EXISTS update_service_incidents_updated_at ON public.service_incidents;
CREATE TRIGGER update_service_incidents_updated_at
  BEFORE UPDATE ON public.service_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Realtime — full row payload + add to publication
ALTER TABLE public.site_settings REPLICA IDENTITY FULL;
ALTER TABLE public.service_status REPLICA IDENTITY FULL;
ALTER TABLE public.system_status REPLICA IDENTITY FULL;
ALTER TABLE public.service_incidents REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'site_settings'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'service_status'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.service_status';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'system_status'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.system_status';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'service_incidents'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.service_incidents';
  END IF;
END $$;

-- 6. Seed default services if table empty
INSERT INTO public.service_status (service_name, display_name, status, status_message)
VALUES
  ('internet', 'Internet résidentiel', 'operational', null),
  ('tv', 'Télévision', 'operational', null),
  ('mobile', 'Mobile', 'operational', null),
  ('client_portal', 'Portail client', 'operational', null),
  ('payments', 'Paiements', 'operational', null),
  ('support', 'Support / Chat', 'operational', null)
ON CONFLICT DO NOTHING;