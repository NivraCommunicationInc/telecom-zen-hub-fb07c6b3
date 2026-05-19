CREATE TABLE IF NOT EXISTS public.coverage_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  region text NOT NULL,
  postal_code_prefix text,
  city text,
  province text NOT NULL DEFAULT 'QC',
  internet_available boolean NOT NULL DEFAULT false,
  tv_available boolean NOT NULL DEFAULT false,
  mobile_available boolean NOT NULL DEFAULT false,
  security_available boolean NOT NULL DEFAULT false,
  max_speed_mbps integer,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','coming_soon','unavailable')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coverage_zones_status ON public.coverage_zones(status);
CREATE INDEX IF NOT EXISTS idx_coverage_zones_postal ON public.coverage_zones(postal_code_prefix);
CREATE INDEX IF NOT EXISTS idx_coverage_zones_region ON public.coverage_zones(region);

ALTER TABLE public.coverage_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active zones"
ON public.coverage_zones FOR SELECT
USING (status = 'active');

CREATE POLICY "Staff view all zones"
ON public.coverage_zones FOR SELECT
TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'support'::app_role) OR has_role(auth.uid(),'supervisor'::app_role));

CREATE POLICY "Admins manage zones - insert"
ON public.coverage_zones FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'supervisor'::app_role));

CREATE POLICY "Admins manage zones - update"
ON public.coverage_zones FOR UPDATE
TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'supervisor'::app_role));

CREATE POLICY "Admins manage zones - delete"
ON public.coverage_zones FOR DELETE
TO authenticated
USING (has_role(auth.uid(),'admin'::app_role));

CREATE OR REPLACE FUNCTION public.set_coverage_zones_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_coverage_zones_updated ON public.coverage_zones;
CREATE TRIGGER trg_coverage_zones_updated
BEFORE UPDATE ON public.coverage_zones
FOR EACH ROW EXECUTE FUNCTION public.set_coverage_zones_updated_at();