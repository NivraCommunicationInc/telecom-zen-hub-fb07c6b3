-- Function to sync order checkout data to profiles (fill-missing-only)
-- This ensures all identity fields are captured on every order creation
CREATE OR REPLACE FUNCTION public.sync_order_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_identity JSONB;
  v_first_name TEXT;
  v_last_name TEXT;
  v_dob DATE;
  v_phone TEXT;
  v_address TEXT;
  v_city TEXT;
  v_province TEXT;
  v_postal_code TEXT;
  v_id_type TEXT;
  v_id_number TEXT;
  v_id_expiration DATE;
  v_id_province TEXT;
BEGIN
  -- Only process if user_id is set
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get current profile
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = NEW.user_id;
  
  -- If no profile exists, skip (profile should be created on user signup)
  IF v_profile IS NULL THEN
    RETURN NEW;
  END IF;

  -- Parse identity_snapshot if available
  v_identity := NEW.identity_snapshot;
  IF v_identity IS NOT NULL THEN
    v_id_type := v_identity->>'id_type';
    v_id_number := v_identity->>'id_number';
    v_id_expiration := CASE 
      WHEN v_identity->>'id_expiration' IS NOT NULL AND v_identity->>'id_expiration' != '' 
      THEN (v_identity->>'id_expiration')::DATE 
      ELSE NULL 
    END;
    v_id_province := v_identity->>'id_province';
  END IF;

  -- Extract first/last name from notes or shipping info
  -- Try to parse from client_email or full_name in notes
  -- The order doesn't store first/last name directly, so we rely on identity or notes

  -- Use shipping address fields if available
  v_phone := NULL; -- Order doesn't have client_phone directly
  v_address := NULLIF(TRIM(COALESCE(NEW.shipping_address, '')), '');
  v_city := NULLIF(TRIM(COALESCE(NEW.shipping_city, '')), '');
  v_province := NULLIF(TRIM(COALESCE(NEW.shipping_province, '')), '');
  v_postal_code := NULLIF(TRIM(COALESCE(NEW.shipping_postal_code, '')), '');

  -- Update profile with fill-missing-only logic using COALESCE
  UPDATE public.profiles SET
    -- Address fields: only update if current value is NULL or empty
    service_address = COALESCE(NULLIF(TRIM(service_address), ''), v_address),
    service_city = COALESCE(NULLIF(TRIM(service_city), ''), v_city),
    service_province = COALESCE(NULLIF(TRIM(service_province), ''), v_province),
    service_postal_code = COALESCE(NULLIF(TRIM(service_postal_code), ''), v_postal_code),
    -- Identity fields: only update if current value is NULL or empty
    id_type = COALESCE(NULLIF(TRIM(id_type), ''), v_id_type),
    id_number = COALESCE(NULLIF(TRIM(id_number), ''), v_id_number),
    id_expiration = COALESCE(id_expiration, v_id_expiration),
    id_province = COALESCE(NULLIF(TRIM(id_province), ''), v_id_province),
    -- Update timestamp
    updated_at = NOW()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

-- Create trigger on orders table (after insert)
DROP TRIGGER IF EXISTS trg_sync_order_to_profile ON public.orders;
CREATE TRIGGER trg_sync_order_to_profile
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_order_to_profile();

-- BACKFILL: Update incomplete profiles from their latest order
-- This runs once to fill missing data for existing clients
DO $$
DECLARE
  v_profile RECORD;
  v_latest_order RECORD;
  v_identity JSONB;
BEGIN
  -- Loop through profiles with missing identity/address data
  FOR v_profile IN 
    SELECT p.user_id, p.first_name, p.last_name, p.date_of_birth, p.phone,
           p.service_address, p.service_city, p.service_province, p.service_postal_code,
           p.id_type, p.id_number, p.id_expiration, p.id_province
    FROM public.profiles p
    WHERE (p.first_name IS NULL OR p.first_name = '')
       OR (p.last_name IS NULL OR p.last_name = '')
       OR (p.service_address IS NULL OR p.service_address = '')
       OR (p.id_type IS NULL OR p.id_type = '')
  LOOP
    -- Get latest order for this user
    SELECT o.* INTO v_latest_order
    FROM public.orders o
    WHERE o.user_id = v_profile.user_id
    ORDER BY o.created_at DESC
    LIMIT 1;
    
    IF v_latest_order IS NOT NULL THEN
      v_identity := v_latest_order.identity_snapshot;
      
      -- Update profile with fill-missing-only logic
      UPDATE public.profiles SET
        -- Address from order
        service_address = COALESCE(
          NULLIF(TRIM(service_address), ''), 
          NULLIF(TRIM(v_latest_order.shipping_address), '')
        ),
        service_city = COALESCE(
          NULLIF(TRIM(service_city), ''), 
          NULLIF(TRIM(v_latest_order.shipping_city), '')
        ),
        service_province = COALESCE(
          NULLIF(TRIM(service_province), ''), 
          NULLIF(TRIM(v_latest_order.shipping_province), '')
        ),
        service_postal_code = COALESCE(
          NULLIF(TRIM(service_postal_code), ''), 
          NULLIF(TRIM(v_latest_order.shipping_postal_code), '')
        ),
        -- Identity from order snapshot
        id_type = COALESCE(
          NULLIF(TRIM(id_type), ''), 
          CASE WHEN v_identity IS NOT NULL THEN v_identity->>'id_type' ELSE NULL END
        ),
        id_number = COALESCE(
          NULLIF(TRIM(id_number), ''), 
          CASE WHEN v_identity IS NOT NULL THEN v_identity->>'id_number' ELSE NULL END
        ),
        id_expiration = COALESCE(
          id_expiration, 
          CASE WHEN v_identity IS NOT NULL AND v_identity->>'id_expiration' IS NOT NULL AND v_identity->>'id_expiration' != ''
               THEN (v_identity->>'id_expiration')::DATE 
               ELSE NULL END
        ),
        id_province = COALESCE(
          NULLIF(TRIM(id_province), ''), 
          CASE WHEN v_identity IS NOT NULL THEN v_identity->>'id_province' ELSE NULL END
        ),
        updated_at = NOW()
      WHERE user_id = v_profile.user_id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Backfill complete for profiles with missing data';
END;
$$;