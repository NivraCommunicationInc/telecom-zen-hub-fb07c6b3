
-- Helper function to normalize text (trim whitespace, convert empty to NULL)
CREATE OR REPLACE FUNCTION public.normalize_text(val text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN NULLIF(TRIM(COALESCE(val, '')), '');
END;
$$;

-- Helper function to split full_name into first/last (best-effort)
CREATE OR REPLACE FUNCTION public.split_full_name(full_name_val text)
RETURNS TABLE(first_name text, last_name text)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized text;
  parts text[];
BEGIN
  normalized := public.normalize_text(full_name_val);
  IF normalized IS NULL THEN
    first_name := NULL;
    last_name := NULL;
    RETURN NEXT;
    RETURN;
  END IF;
  
  parts := string_to_array(normalized, ' ');
  IF array_length(parts, 1) = 1 THEN
    first_name := parts[1];
    last_name := NULL;
  ELSE
    first_name := parts[1];
    last_name := array_to_string(parts[2:], ' ');
  END IF;
  RETURN NEXT;
END;
$$;

-- Updated sync function with TRIM/NULLIF normalization and full_name sync
CREATE OR REPLACE FUNCTION public.sync_order_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_first_name text;
  v_last_name text;
  v_full_name text;
  v_dob date;
  v_phone text;
  v_address text;
  v_city text;
  v_province text;
  v_postal text;
  v_id_type text;
  v_id_number text;
  v_id_exp date;
  v_id_prov text;
  existing_first text;
  existing_last text;
  existing_full text;
  split_result record;
BEGIN
  -- Normalize all incoming values
  v_first_name := public.normalize_text(NEW.client_first_name);
  v_last_name := public.normalize_text(NEW.client_last_name);
  v_dob := NEW.client_dob;
  v_phone := public.normalize_text(NEW.client_phone);
  v_address := public.normalize_text(NEW.shipping_address);
  v_city := public.normalize_text(NEW.shipping_city);
  v_province := public.normalize_text(NEW.shipping_province);
  v_postal := public.normalize_text(NEW.shipping_postal_code);
  
  -- Extract identity fields from snapshot if present
  IF NEW.identity_snapshot IS NOT NULL THEN
    v_id_type := public.normalize_text(NEW.identity_snapshot->>'id_type');
    v_id_number := public.normalize_text(NEW.identity_snapshot->>'id_number');
    v_id_prov := public.normalize_text(NEW.identity_snapshot->>'id_province');
    BEGIN
      v_id_exp := (NEW.identity_snapshot->>'id_expiration')::date;
    EXCEPTION WHEN OTHERS THEN
      v_id_exp := NULL;
    END;
  END IF;

  -- Get existing profile values
  SELECT 
    public.normalize_text(first_name),
    public.normalize_text(last_name),
    public.normalize_text(full_name)
  INTO existing_first, existing_last, existing_full
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Build full_name from first+last if we have them
  IF v_first_name IS NOT NULL OR v_last_name IS NOT NULL THEN
    v_full_name := TRIM(COALESCE(v_first_name, '') || ' ' || COALESCE(v_last_name, ''));
    v_full_name := public.normalize_text(v_full_name);
  ELSE
    v_full_name := NULL;
  END IF;

  -- If we don't have first/last but existing profile has full_name, try to split it
  IF v_first_name IS NULL AND v_last_name IS NULL AND existing_full IS NOT NULL THEN
    SELECT * INTO split_result FROM public.split_full_name(existing_full);
    IF existing_first IS NULL THEN
      v_first_name := split_result.first_name;
    END IF;
    IF existing_last IS NULL THEN
      v_last_name := split_result.last_name;
    END IF;
  END IF;

  -- Update profile with fill-missing-only logic (COALESCE preserves existing non-null values)
  UPDATE public.profiles SET
    first_name = COALESCE(public.normalize_text(first_name), v_first_name),
    last_name = COALESCE(public.normalize_text(last_name), v_last_name),
    full_name = COALESCE(
      public.normalize_text(full_name),
      v_full_name,
      TRIM(COALESCE(public.normalize_text(first_name), v_first_name, '') || ' ' || COALESCE(public.normalize_text(last_name), v_last_name, ''))
    ),
    date_of_birth = COALESCE(date_of_birth, v_dob),
    phone = COALESCE(public.normalize_text(phone), v_phone),
    service_address = COALESCE(public.normalize_text(service_address), v_address),
    service_city = COALESCE(public.normalize_text(service_city), v_city),
    service_province = COALESCE(public.normalize_text(service_province), v_province),
    service_postal_code = COALESCE(public.normalize_text(service_postal_code), v_postal),
    id_type = COALESCE(public.normalize_text(id_type), v_id_type),
    id_number = COALESCE(public.normalize_text(id_number), v_id_number),
    id_expiration = COALESCE(id_expiration, v_id_exp),
    id_province = COALESCE(public.normalize_text(id_province), v_id_prov),
    updated_at = now()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

-- Idempotent backfill: updates profiles with missing data from latest order
-- Safe to rerun - only fills NULL/empty fields, never overwrites existing data
DO $$
DECLARE
  r record;
  v_first text;
  v_last text;
  v_full text;
  v_dob date;
  v_phone text;
  v_addr text;
  v_city text;
  v_prov text;
  v_postal text;
  v_id_type text;
  v_id_number text;
  v_id_exp date;
  v_id_prov text;
  split_result record;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (o.user_id)
      o.user_id,
      o.client_first_name,
      o.client_last_name,
      o.client_dob,
      o.client_phone,
      o.shipping_address,
      o.shipping_city,
      o.shipping_province,
      o.shipping_postal_code,
      o.identity_snapshot,
      p.first_name AS existing_first,
      p.last_name AS existing_last,
      p.full_name AS existing_full,
      p.date_of_birth AS existing_dob,
      p.phone AS existing_phone,
      p.service_address AS existing_addr,
      p.service_city AS existing_city,
      p.service_province AS existing_prov,
      p.service_postal_code AS existing_postal,
      p.id_type AS existing_id_type,
      p.id_number AS existing_id_number,
      p.id_expiration AS existing_id_exp,
      p.id_province AS existing_id_prov
    FROM public.orders o
    JOIN public.profiles p ON p.id = o.user_id
    WHERE (
      public.normalize_text(p.first_name) IS NULL OR
      public.normalize_text(p.last_name) IS NULL OR
      public.normalize_text(p.full_name) IS NULL OR
      p.date_of_birth IS NULL OR
      public.normalize_text(p.phone) IS NULL OR
      public.normalize_text(p.service_address) IS NULL OR
      public.normalize_text(p.service_city) IS NULL OR
      public.normalize_text(p.service_province) IS NULL OR
      public.normalize_text(p.service_postal_code) IS NULL
    )
    ORDER BY o.user_id, o.created_at DESC
  LOOP
    -- Normalize order values
    v_first := public.normalize_text(r.client_first_name);
    v_last := public.normalize_text(r.client_last_name);
    v_dob := r.client_dob;
    v_phone := public.normalize_text(r.client_phone);
    v_addr := public.normalize_text(r.shipping_address);
    v_city := public.normalize_text(r.shipping_city);
    v_prov := public.normalize_text(r.shipping_province);
    v_postal := public.normalize_text(r.shipping_postal_code);

    -- Extract identity from snapshot
    IF r.identity_snapshot IS NOT NULL THEN
      v_id_type := public.normalize_text(r.identity_snapshot->>'id_type');
      v_id_number := public.normalize_text(r.identity_snapshot->>'id_number');
      v_id_prov := public.normalize_text(r.identity_snapshot->>'id_province');
      BEGIN
        v_id_exp := (r.identity_snapshot->>'id_expiration')::date;
      EXCEPTION WHEN OTHERS THEN
        v_id_exp := NULL;
      END;
    ELSE
      v_id_type := NULL;
      v_id_number := NULL;
      v_id_exp := NULL;
      v_id_prov := NULL;
    END IF;

    -- Build full_name from first+last
    IF v_first IS NOT NULL OR v_last IS NOT NULL THEN
      v_full := public.normalize_text(TRIM(COALESCE(v_first, '') || ' ' || COALESCE(v_last, '')));
    ELSE
      v_full := NULL;
    END IF;

    -- If no first/last from order but profile has full_name, split it
    IF v_first IS NULL AND v_last IS NULL AND public.normalize_text(r.existing_full) IS NOT NULL THEN
      SELECT * INTO split_result FROM public.split_full_name(r.existing_full);
      v_first := split_result.first_name;
      v_last := split_result.last_name;
      v_full := public.normalize_text(r.existing_full);
    END IF;

    -- Update with fill-missing-only logic
    UPDATE public.profiles SET
      first_name = COALESCE(public.normalize_text(first_name), v_first),
      last_name = COALESCE(public.normalize_text(last_name), v_last),
      full_name = COALESCE(
        public.normalize_text(full_name),
        v_full,
        public.normalize_text(TRIM(COALESCE(public.normalize_text(first_name), v_first, '') || ' ' || COALESCE(public.normalize_text(last_name), v_last, '')))
      ),
      date_of_birth = COALESCE(date_of_birth, v_dob),
      phone = COALESCE(public.normalize_text(phone), v_phone),
      service_address = COALESCE(public.normalize_text(service_address), v_addr),
      service_city = COALESCE(public.normalize_text(service_city), v_city),
      service_province = COALESCE(public.normalize_text(service_province), v_prov),
      service_postal_code = COALESCE(public.normalize_text(service_postal_code), v_postal),
      id_type = COALESCE(public.normalize_text(id_type), v_id_type),
      id_number = COALESCE(public.normalize_text(id_number), v_id_number),
      id_expiration = COALESCE(id_expiration, v_id_exp),
      id_province = COALESCE(public.normalize_text(id_province), v_id_prov),
      updated_at = now()
    WHERE id = r.user_id;
  END LOOP;
END;
$$;
