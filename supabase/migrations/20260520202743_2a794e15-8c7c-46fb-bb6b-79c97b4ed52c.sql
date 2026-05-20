
ALTER TABLE public.coverage_zones
  ADD COLUMN IF NOT EXISTS postal_codes TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS coverage_type TEXT DEFAULT 'fiber',
  ADD COLUMN IF NOT EXISTS center_lat DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS center_lng DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS radius_km DECIMAL(5,2) DEFAULT 2.0,
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#8B5CF6',
  ADD COLUMN IF NOT EXISTS client_count INTEGER DEFAULT 0;

-- Backfill postal_codes from prefix where empty
UPDATE public.coverage_zones
   SET postal_codes = ARRAY[postal_code_prefix]
 WHERE postal_code_prefix IS NOT NULL
   AND (postal_codes IS NULL OR cardinality(postal_codes) = 0);

-- Loosen status check to allow 'maintenance'
ALTER TABLE public.coverage_zones DROP CONSTRAINT IF EXISTS coverage_zones_status_check;
ALTER TABLE public.coverage_zones
  ADD CONSTRAINT coverage_zones_status_check
  CHECK (status IN ('active','coming_soon','planned','maintenance','unavailable'));

-- Coverage type check
ALTER TABLE public.coverage_zones DROP CONSTRAINT IF EXISTS coverage_zones_type_check;
ALTER TABLE public.coverage_zones
  ADD CONSTRAINT coverage_zones_type_check
  CHECK (coverage_type IN ('fiber','cable','wireless'));

-- Seed Montreal zones
INSERT INTO public.coverage_zones (name, region, postal_codes, postal_code_prefix, city, province, status, coverage_type, center_lat, center_lng, radius_km, color, internet_available)
SELECT * FROM (VALUES
  ('Montréal-Nord','Montréal',ARRAY['H1G','H1H','H2B'],'H1G','Montréal','QC','active','fiber',45.5955,-73.6403,3.5,'#8B5CF6',true),
  ('Laval Centre','Laval',ARRAY['H7A','H7B','H7C','H7E'],'H7A','Laval','QC','active','fiber',45.6066,-73.7124,4.0,'#06B6D4',true),
  ('Saint-Léonard','Montréal',ARRAY['H1R','H1S','H1P'],'H1R','Montréal','QC','active','fiber',45.5830,-73.5748,2.5,'#10B981',true),
  ('Anjou','Montréal',ARRAY['H1J','H1K','H1M'],'H1J','Montréal','QC','planned','fiber',45.5742,-73.5558,2.0,'#F59E0B',false),
  ('Repentigny','Lanaudière',ARRAY['J5Y','J6A','J6W'],'J5Y','Repentigny','QC','planned','cable',45.7414,-73.4605,3.0,'#EF4444',false)
) AS v(name,region,postal_codes,postal_code_prefix,city,province,status,coverage_type,center_lat,center_lng,radius_km,color,internet_available)
WHERE NOT EXISTS (SELECT 1 FROM public.coverage_zones cz WHERE cz.name = v.name);
