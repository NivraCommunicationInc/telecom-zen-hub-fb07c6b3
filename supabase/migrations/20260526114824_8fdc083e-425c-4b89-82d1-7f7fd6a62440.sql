-- Stabiliser définitivement le code de référence client et synchroniser les adresses manquantes.

CREATE OR REPLACE FUNCTION public.ensure_client_referral_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code text;
  v_profile_code text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT NULLIF(TRIM(referral_code), '') INTO v_profile_code
  FROM public.profiles
  WHERE user_id = p_user_id
  LIMIT 1;

  SELECT code INTO v_code
  FROM public.referral_codes
  WHERE owner_user_id = p_user_id
    AND COALESCE(code_type, 'client') = 'client'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_code IS NOT NULL THEN
    UPDATE public.profiles
    SET referral_code = COALESCE(NULLIF(TRIM(referral_code), ''), v_code)
    WHERE user_id = p_user_id;
    RETURN v_code;
  END IF;

  v_code := COALESCE(v_profile_code, public.generate_client_referral_code(p_user_id));

  INSERT INTO public.referral_codes (owner_user_id, code, status, code_type)
  VALUES (p_user_id, v_code, 'active', 'client')
  ON CONFLICT DO NOTHING;

  SELECT code INTO v_code
  FROM public.referral_codes
  WHERE owner_user_id = p_user_id
    AND COALESCE(code_type, 'client') = 'client'
  ORDER BY created_at ASC
  LIMIT 1;

  UPDATE public.profiles
  SET referral_code = COALESCE(NULLIF(TRIM(referral_code), ''), v_code)
  WHERE user_id = p_user_id;

  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_client_referral_code(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_client_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.referral_code IS NOT NULL
     AND TRIM(OLD.referral_code) <> ''
     AND NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
    NEW.referral_code := OLD.referral_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_client_referral_code ON public.profiles;
CREATE TRIGGER trg_protect_client_referral_code
BEFORE UPDATE OF referral_code ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_client_referral_code();

CREATE OR REPLACE FUNCTION public.sync_account_address_from_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account_id uuid;
  v_user_id uuid;
  v_addr text;
  v_city text;
  v_province text;
  v_postal text;
BEGIN
  v_account_id := NEW.account_id;
  v_user_id := NEW.user_id;
  v_addr := NULLIF(TRIM(NEW.shipping_address), '');
  v_city := NULLIF(TRIM(NEW.shipping_city), '');
  v_province := COALESCE(NULLIF(TRIM(NEW.shipping_province), ''), 'QC');
  v_postal := NULLIF(TRIM(NEW.shipping_postal_code), '');

  IF v_addr IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_account_id IS NULL AND v_user_id IS NOT NULL THEN
    SELECT id INTO v_account_id
    FROM public.accounts
    WHERE client_id = v_user_id
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_account_id IS NOT NULL THEN
    UPDATE public.accounts
    SET primary_service_address = COALESCE(NULLIF(TRIM(primary_service_address), ''), v_addr),
        primary_service_city = COALESCE(NULLIF(TRIM(primary_service_city), ''), v_city),
        primary_service_province = COALESCE(NULLIF(TRIM(primary_service_province), ''), v_province),
        primary_service_postal_code = COALESCE(NULLIF(TRIM(primary_service_postal_code), ''), v_postal)
    WHERE id = v_account_id;
  END IF;

  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET service_address = COALESCE(NULLIF(TRIM(service_address), ''), v_addr),
        service_city = COALESCE(NULLIF(TRIM(service_city), ''), v_city),
        service_province = COALESCE(NULLIF(TRIM(service_province), ''), v_province),
        service_postal_code = COALESCE(NULLIF(TRIM(service_postal_code), ''), v_postal)
    WHERE user_id = v_user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_account_address_from_order ON public.orders;
CREATE TRIGGER trg_sync_account_address_from_order
AFTER INSERT OR UPDATE OF shipping_address, shipping_city, shipping_province, shipping_postal_code, account_id, user_id ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_account_address_from_order();