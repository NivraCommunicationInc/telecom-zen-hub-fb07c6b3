-- Add client identity fields to orders table for complete profile sync
-- These fields are captured during checkout and synced to profiles via trigger

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS client_first_name TEXT,
ADD COLUMN IF NOT EXISTS client_last_name TEXT,
ADD COLUMN IF NOT EXISTS client_dob DATE,
ADD COLUMN IF NOT EXISTS client_phone TEXT;

-- Update the sync function to use these new columns
CREATE OR REPLACE FUNCTION public.sync_order_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_identity JSONB;
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

  -- Update profile with fill-missing-only logic using COALESCE
  -- Each field is only updated if the profile value is NULL or empty
  UPDATE public.profiles SET
    -- Name fields
    first_name = COALESCE(
      NULLIF(TRIM(first_name), ''), 
      NULLIF(TRIM(NEW.client_first_name), '')
    ),
    last_name = COALESCE(
      NULLIF(TRIM(last_name), ''), 
      NULLIF(TRIM(NEW.client_last_name), '')
    ),
    -- Date of birth
    date_of_birth = COALESCE(date_of_birth, NEW.client_dob),
    -- Phone
    phone = COALESCE(
      NULLIF(TRIM(phone), ''), 
      NULLIF(TRIM(NEW.client_phone), '')
    ),
    -- Address fields
    service_address = COALESCE(
      NULLIF(TRIM(service_address), ''), 
      NULLIF(TRIM(NEW.shipping_address), '')
    ),
    service_city = COALESCE(
      NULLIF(TRIM(service_city), ''), 
      NULLIF(TRIM(NEW.shipping_city), '')
    ),
    service_province = COALESCE(
      NULLIF(TRIM(service_province), ''), 
      NULLIF(TRIM(NEW.shipping_province), '')
    ),
    service_postal_code = COALESCE(
      NULLIF(TRIM(service_postal_code), ''), 
      NULLIF(TRIM(NEW.shipping_postal_code), '')
    ),
    -- Identity document fields from snapshot
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
      CASE 
        WHEN v_identity IS NOT NULL 
          AND v_identity->>'id_expiration' IS NOT NULL 
          AND v_identity->>'id_expiration' != ''
        THEN (v_identity->>'id_expiration')::DATE 
        ELSE NULL 
      END
    ),
    id_province = COALESCE(
      NULLIF(TRIM(id_province), ''), 
      CASE WHEN v_identity IS NOT NULL THEN v_identity->>'id_province' ELSE NULL END
    ),
    -- Update timestamp
    updated_at = NOW()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

-- Re-run backfill with new columns
-- Note: The new client_ columns don't exist in old orders, but shipping_ columns do
DO $$
DECLARE
  v_profile RECORD;
  v_latest_order RECORD;
  v_identity JSONB;
BEGIN
  FOR v_profile IN 
    SELECT p.user_id
    FROM public.profiles p
    WHERE (p.first_name IS NULL OR p.first_name = '')
       OR (p.last_name IS NULL OR p.last_name = '')
       OR (p.service_address IS NULL OR p.service_address = '')
       OR (p.phone IS NULL OR p.phone = '')
  LOOP
    SELECT o.* INTO v_latest_order
    FROM public.orders o
    WHERE o.user_id = v_profile.user_id
    ORDER BY o.created_at DESC
    LIMIT 1;
    
    IF v_latest_order IS NOT NULL THEN
      v_identity := v_latest_order.identity_snapshot;
      
      UPDATE public.profiles SET
        first_name = COALESCE(
          NULLIF(TRIM(first_name), ''), 
          NULLIF(TRIM(v_latest_order.client_first_name), '')
        ),
        last_name = COALESCE(
          NULLIF(TRIM(last_name), ''), 
          NULLIF(TRIM(v_latest_order.client_last_name), '')
        ),
        date_of_birth = COALESCE(date_of_birth, v_latest_order.client_dob),
        phone = COALESCE(
          NULLIF(TRIM(phone), ''), 
          NULLIF(TRIM(v_latest_order.client_phone), '')
        ),
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
END;
$$;