-- Create DOB validation trigger for profiles and orders tables
-- CRITICAL: Minimum age is 13 years (legal requirement for telecom in Quebec)

-- Debug table for DOB validation (temporary)
CREATE TABLE IF NOT EXISTS public.dob_validation_debug (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  table_name text NOT NULL,
  column_name text NOT NULL,
  raw_value text,
  calculated_age integer,
  result text
);

-- Enable RLS on debug table
ALTER TABLE public.dob_validation_debug ENABLE ROW LEVEL SECURITY;

-- Policy to allow trigger inserts (SECURITY DEFINER functions)
CREATE POLICY "Allow trigger inserts on dob_validation_debug"
ON public.dob_validation_debug
FOR INSERT
WITH CHECK (true);

-- Policy to allow authenticated reads for debugging
CREATE POLICY "Allow authenticated reads on dob_validation_debug"
ON public.dob_validation_debug
FOR SELECT
USING (auth.role() = 'authenticated');

-- Function to validate DOB with minimum age 13
CREATE OR REPLACE FUNCTION public.validate_dob_min_age()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dob_column text;
  dob_value date;
  age_years integer;
  min_age constant integer := 13;
BEGIN
  -- Determine which column to check based on table
  IF TG_TABLE_NAME = 'profiles' THEN
    dob_value := NEW.date_of_birth;
    dob_column := 'date_of_birth';
  ELSIF TG_TABLE_NAME = 'orders' THEN
    dob_value := NEW.client_dob;
    dob_column := 'client_dob';
  ELSE
    RETURN NEW;
  END IF;
  
  -- NULL is allowed (optional field)
  IF dob_value IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Calculate age
  age_years := EXTRACT(YEAR FROM age(CURRENT_DATE, dob_value));
  
  -- Log for debugging (temporary)
  INSERT INTO public.dob_validation_debug(table_name, column_name, raw_value, calculated_age, result)
  VALUES (TG_TABLE_NAME, dob_column, dob_value::text, age_years, 
    CASE WHEN age_years < min_age THEN 'REJECTED' ELSE 'OK' END);
  
  -- Reject if under minimum age
  IF age_years < min_age THEN
    RAISE EXCEPTION 'Date of birth validation failed: minimum age is % years. Calculated age: %', min_age, age_years;
  END IF;
  
  -- Reject future dates
  IF dob_value > CURRENT_DATE THEN
    RAISE EXCEPTION 'Date of birth cannot be in the future';
  END IF;
  
  -- Reject unreasonable ages (over 120)
  IF age_years > 120 THEN
    RAISE EXCEPTION 'Date of birth validation failed: please enter a valid date';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for profiles table
DROP TRIGGER IF EXISTS trg_profiles_validate_dob ON public.profiles;
CREATE TRIGGER trg_profiles_validate_dob
BEFORE INSERT OR UPDATE OF date_of_birth
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_dob_min_age();

-- Create trigger for orders table
DROP TRIGGER IF EXISTS trg_orders_validate_dob ON public.orders;
CREATE TRIGGER trg_orders_validate_dob
BEFORE INSERT OR UPDATE OF client_dob
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.validate_dob_min_age();