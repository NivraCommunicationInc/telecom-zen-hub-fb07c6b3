-- =========================================================
-- DOB ENFORCEMENT: Reject NULL + invalid DOB on NEW orders
-- (Does NOT affect existing 60 NULL rows — clean later)
-- =========================================================

-- 1) Replace the validate_dob_min_age function to ALSO reject NULL on orders
CREATE OR REPLACE FUNCTION public.validate_dob_min_age()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    -- NULL is allowed on profiles (optional field)
    IF dob_value IS NULL THEN
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'orders' THEN
    dob_value := NEW.client_dob;
    dob_column := 'client_dob';
    -- CRITICAL: NULL is NOT allowed on orders (new inserts)
    IF dob_value IS NULL THEN
      INSERT INTO public.dob_validation_debug(table_name, column_name, raw_value, calculated_age, result)
      VALUES (TG_TABLE_NAME, dob_column, NULL, NULL, 'REJECT_NULL');
      RAISE EXCEPTION 'Date of birth is required for orders (client_dob cannot be NULL)';
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  -- Reject future dates
  IF dob_value > CURRENT_DATE THEN
    INSERT INTO public.dob_validation_debug(table_name, column_name, raw_value, calculated_age, result)
    VALUES (TG_TABLE_NAME, dob_column, dob_value::text, NULL, 'REJECT_FUTURE');
    RAISE EXCEPTION 'Date of birth cannot be in the future';
  END IF;

  -- Reject under minimum age (13 years)
  min_allowed_date := (CURRENT_DATE - (min_age::text || ' years')::interval)::date;
  IF dob_value > min_allowed_date THEN
    INSERT INTO public.dob_validation_debug(table_name, column_name, raw_value, calculated_age, result)
    VALUES (TG_TABLE_NAME, dob_column, dob_value::text, NULL, 'REJECT_UNDER_13');
    RAISE EXCEPTION 'Date of birth validation failed: minimum age is % years', min_age;
  END IF;

  -- Reject over 120 years (sanity check)
  max_allowed_date := (CURRENT_DATE - interval '120 years')::date;
  IF dob_value < max_allowed_date THEN
    INSERT INTO public.dob_validation_debug(table_name, column_name, raw_value, calculated_age, result)
    VALUES (TG_TABLE_NAME, dob_column, dob_value::text, NULL, 'REJECT_OVER_120');
    RAISE EXCEPTION 'Date of birth validation failed: please enter a valid date';
  END IF;

  -- Success
  INSERT INTO public.dob_validation_debug(table_name, column_name, raw_value, calculated_age, result)
  VALUES (TG_TABLE_NAME, dob_column, dob_value::text, NULL, 'OK');

  RETURN NEW;
END;
$$;

-- 2) Add CHECK constraint NOT VALID (blocks new inserts but skips existing rows)
-- This provides defense-in-depth if trigger is somehow bypassed
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_client_dob_not_null_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_client_dob_not_null_check
  CHECK (client_dob IS NOT NULL)
  NOT VALID;

-- 3) Add CHECK constraints for age bounds (also NOT VALID)
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_client_dob_min_age_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_client_dob_min_age_check
  CHECK (client_dob <= CURRENT_DATE - interval '13 years')
  NOT VALID;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_client_dob_not_future_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_client_dob_not_future_check
  CHECK (client_dob <= CURRENT_DATE)
  NOT VALID;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_client_dob_max_age_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_client_dob_max_age_check
  CHECK (client_dob >= CURRENT_DATE - interval '120 years')
  NOT VALID;