
CREATE TABLE IF NOT EXISTS public.technician_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL,
  installation_job_id UUID REFERENCES public.installation_jobs(id) ON DELETE SET NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy_meters DECIMAL(8, 2),
  heading DECIMAL(5, 2),
  speed_kmh DECIMAL(6, 2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT technician_locations_technician_unique UNIQUE (technician_id)
);

CREATE INDEX IF NOT EXISTS idx_tech_locations_tech_active
  ON public.technician_locations(technician_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_tech_locations_job
  ON public.technician_locations(installation_job_id)
  WHERE is_active = true;

ALTER TABLE public.technician_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Technicians manage own location" ON public.technician_locations;
CREATE POLICY "Technicians manage own location"
  ON public.technician_locations
  FOR ALL
  TO authenticated
  USING (auth.uid() = technician_id)
  WITH CHECK (auth.uid() = technician_id);

DROP POLICY IF EXISTS "Internal staff view all locations" ON public.technician_locations;
CREATE POLICY "Internal staff view all locations"
  ON public.technician_locations
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'support'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
  );

CREATE OR REPLACE FUNCTION public.update_technician_locations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_technician_locations_updated_at ON public.technician_locations;
CREATE TRIGGER trg_technician_locations_updated_at
BEFORE UPDATE ON public.technician_locations
FOR EACH ROW EXECUTE FUNCTION public.update_technician_locations_updated_at();

CREATE OR REPLACE FUNCTION public.get_order_technician_eta(p_order_number TEXT)
RETURNS TABLE (
  has_technician BOOLEAN,
  on_site BOOLEAN,
  eta_minutes INTEGER,
  last_update TIMESTAMPTZ,
  technician_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_job_id UUID;
  v_loc RECORD;
  v_tech_name TEXT;
BEGIN
  SELECT id INTO v_order_id FROM public.orders WHERE order_number = p_order_number LIMIT 1;
  IF v_order_id IS NULL THEN
    RETURN QUERY SELECT false, false, NULL::INTEGER, NULL::TIMESTAMPTZ, NULL::TEXT;
    RETURN;
  END IF;

  SELECT id INTO v_job_id
    FROM public.installation_jobs
   WHERE order_id = v_order_id
     AND status IN ('scheduled','en_route','on_the_way','in_progress','started')
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_job_id IS NULL THEN
    RETURN QUERY SELECT false, false, NULL::INTEGER, NULL::TIMESTAMPTZ, NULL::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_loc
    FROM public.technician_locations
   WHERE installation_job_id = v_job_id
     AND is_active = true
     AND recorded_at > now() - INTERVAL '10 minutes'
   ORDER BY recorded_at DESC
   LIMIT 1;

  IF v_loc.id IS NULL THEN
    RETURN QUERY SELECT true, false, NULL::INTEGER, NULL::TIMESTAMPTZ, NULL::TEXT;
    RETURN;
  END IF;

  SELECT full_name INTO v_tech_name FROM public.technicians WHERE user_id = v_loc.technician_id LIMIT 1;

  RETURN QUERY SELECT
    true,
    (COALESCE(v_loc.speed_kmh, 0) < 2),
    NULL::INTEGER,
    v_loc.recorded_at,
    v_tech_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_technician_eta(TEXT) TO anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.technician_locations;
