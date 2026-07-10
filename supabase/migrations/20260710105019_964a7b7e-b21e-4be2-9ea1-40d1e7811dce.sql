
CREATE TABLE IF NOT EXISTS public.mobile_addons_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_code text NOT NULL UNIQUE,
  addon_name text NOT NULL,
  addon_type text NOT NULL CHECK (addon_type IN ('data','international','long_distance','roaming','voicemail','other')),
  monthly_price numeric(10,2) NOT NULL DEFAULT 0 CHECK (monthly_price >= 0),
  one_time_price numeric(10,2) NOT NULL DEFAULT 0 CHECK (one_time_price >= 0),
  currency text NOT NULL DEFAULT 'CAD',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mobile_addons_catalog TO anon, authenticated;
GRANT ALL ON public.mobile_addons_catalog TO service_role;

ALTER TABLE public.mobile_addons_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mobile_addons_catalog public read active"
  ON public.mobile_addons_catalog FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "mobile_addons_catalog admin insert"
  ON public.mobile_addons_catalog FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "mobile_addons_catalog admin update"
  ON public.mobile_addons_catalog FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "mobile_addons_catalog admin delete"
  ON public.mobile_addons_catalog FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_mobile_addons_catalog_updated ON public.mobile_addons_catalog;
CREATE TRIGGER trg_mobile_addons_catalog_updated
  BEFORE UPDATE ON public.mobile_addons_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_mobile_addons_catalog_active ON public.mobile_addons_catalog(is_active, sort_order);
