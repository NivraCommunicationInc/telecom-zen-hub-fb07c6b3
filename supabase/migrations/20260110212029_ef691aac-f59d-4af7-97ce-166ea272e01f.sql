-- DOB definitive enforcement: strict date comparisons + remove duplicate trigger + tighten debug RLS

-- 1) Remove overly-permissive INSERT policies on debug tables (triggers bypass RLS; API inserts not needed)
DROP POLICY IF EXISTS "Allow trigger inserts on dob_validation_debug" ON public.dob_validation_debug;
DROP POLICY IF EXISTS "Allow trigger inserts" ON public.support_ticket_id_status_debug;

-- 2) Replace DOB guard with strict date comparisons
CREATE OR REPLACE FUNCTION public.validate_dob_min_age()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dob_column text;
  dob_value date;
  min_age constant integer := 13;
  min_allowed_date date;
  max_allowed_date date;
BEGIN
  IF TG_TABLE_NAME = 'profiles' THEN
    dob_value := NEW.date_of_birth;
    dob_column := 'date_of_birth';
  ELSIF TG_TABLE_NAME = 'orders' THEN
    dob_value := NEW.client_dob;
    dob_column := 'client_dob';
  ELSE
    RETURN NEW;
  END IF;

  -- NULL allowed
  IF dob_value IS NULL THEN
    RETURN NEW;
  END IF;

  -- Strict bounds
  IF dob_value > CURRENT_DATE THEN
    INSERT INTO public.dob_validation_debug(table_name, column_name, raw_value, calculated_age, result)
    VALUES (TG_TABLE_NAME, dob_column, dob_value::text, NULL, 'REJECT_FUTURE');
    RAISE EXCEPTION 'Date of birth cannot be in the future';
  END IF;

  min_allowed_date := (CURRENT_DATE - (min_age::text || ' years')::interval)::date;
  IF dob_value > min_allowed_date THEN
    INSERT INTO public.dob_validation_debug(table_name, column_name, raw_value, calculated_age, result)
    VALUES (TG_TABLE_NAME, dob_column, dob_value::text, NULL, 'REJECT_UNDER_13');
    RAISE EXCEPTION 'Date of birth validation failed: minimum age is % years', min_age;
  END IF;

  max_allowed_date := (CURRENT_DATE - interval '120 years')::date;
  IF dob_value < max_allowed_date THEN
    INSERT INTO public.dob_validation_debug(table_name, column_name, raw_value, calculated_age, result)
    VALUES (TG_TABLE_NAME, dob_column, dob_value::text, NULL, 'REJECT_OVER_120');
    RAISE EXCEPTION 'Date of birth validation failed: please enter a valid date';
  END IF;

  INSERT INTO public.dob_validation_debug(table_name, column_name, raw_value, calculated_age, result)
  VALUES (TG_TABLE_NAME, dob_column, dob_value::text, NULL, 'OK');

  RETURN NEW;
END;
$$;

-- 3) Remove duplicate/legacy trigger that can conflict
DROP TRIGGER IF EXISTS trigger_validate_dob_profiles ON public.profiles;

-- Ensure triggers are attached (idempotent)
DROP TRIGGER IF EXISTS trg_profiles_validate_dob ON public.profiles;
CREATE TRIGGER trg_profiles_validate_dob
BEFORE INSERT OR UPDATE OF date_of_birth
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_dob_min_age();

DROP TRIGGER IF EXISTS trg_orders_validate_dob ON public.orders;
CREATE TRIGGER trg_orders_validate_dob
BEFORE INSERT OR UPDATE OF client_dob
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.validate_dob_min_age();
