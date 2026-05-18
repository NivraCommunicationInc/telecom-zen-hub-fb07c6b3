ALTER TABLE public.service_addresses
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

CREATE INDEX IF NOT EXISTS idx_service_addresses_geo
  ON public.service_addresses(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Replace ETA RPC to actually compute minutes via haversine
CREATE OR REPLACE FUNCTION public.get_order_technician_eta(p_order_number text)
RETURNS TABLE(has_technician boolean, on_site boolean, eta_minutes integer, last_update timestamp with time zone, technician_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id UUID;
  v_job_id UUID;
  v_addr_lat NUMERIC;
  v_addr_lng NUMERIC;
  v_loc RECORD;
  v_tech_name TEXT;
  v_dist_km NUMERIC;
  v_speed NUMERIC;
  v_eta INT;
  v_on_site BOOLEAN;
BEGIN
  SELECT id INTO v_order_id FROM public.orders WHERE order_number = p_order_number LIMIT 1;
  IF v_order_id IS NULL THEN
    RETURN QUERY SELECT false, false, NULL::INTEGER, NULL::TIMESTAMPTZ, NULL::TEXT;
    RETURN;
  END IF;

  SELECT ij.id, sa.latitude, sa.longitude
    INTO v_job_id, v_addr_lat, v_addr_lng
    FROM public.installation_jobs ij
    LEFT JOIN public.service_addresses sa ON sa.id = ij.address_id
   WHERE ij.order_id = v_order_id
     AND ij.status IN ('scheduled','en_route','on_the_way','in_progress','started')
   ORDER BY ij.created_at DESC
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

  SELECT full_name INTO v_tech_name
    FROM public.technicians
   WHERE user_id = v_loc.technician_id
   LIMIT 1;

  -- Haversine distance in km (only if both endpoints have coords)
  IF v_addr_lat IS NOT NULL AND v_addr_lng IS NOT NULL
     AND v_loc.latitude IS NOT NULL AND v_loc.longitude IS NOT NULL THEN
    v_dist_km := 2 * 6371 * asin(sqrt(
      power(sin(radians((v_addr_lat - v_loc.latitude) / 2)), 2)
      + cos(radians(v_loc.latitude)) * cos(radians(v_addr_lat))
        * power(sin(radians((v_addr_lng - v_loc.longitude) / 2)), 2)
    ));
    -- On site if within 100m
    v_on_site := v_dist_km < 0.1;
    -- Use technician speed if moving, else fallback 35 km/h urban
    v_speed := CASE
      WHEN COALESCE(v_loc.speed_kmh, 0) >= 5 THEN v_loc.speed_kmh
      ELSE 35
    END;
    IF NOT v_on_site THEN
      v_eta := GREATEST(1, ROUND((v_dist_km / v_speed) * 60)::INT);
    END IF;
  ELSE
    -- No coords → fall back to speed-only on-site heuristic, no ETA number
    v_on_site := COALESCE(v_loc.speed_kmh, 0) < 2;
  END IF;

  RETURN QUERY SELECT
    true,
    v_on_site,
    v_eta,
    v_loc.recorded_at,
    v_tech_name;
END;
$function$;