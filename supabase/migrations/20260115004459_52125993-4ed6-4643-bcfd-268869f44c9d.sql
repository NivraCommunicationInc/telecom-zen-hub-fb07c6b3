-- Update the DOB validation trigger to enforce minimum age of 16 years (Nivra business requirement)
CREATE OR REPLACE FUNCTION public.validate_dob_age()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dob_column text;
  dob_value date;
  min_age constant integer := 16;
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

  -- Skip validation if DOB is null (handle separately if required)
  IF dob_value IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate date boundaries
  min_allowed_date := CURRENT_DATE - INTERVAL '120 years';
  max_allowed_date := CURRENT_DATE - (min_age || ' years')::interval;

  -- Validate: not in future
  IF dob_value > CURRENT_DATE THEN
    RAISE EXCEPTION 'Date of birth cannot be in the future' 
      USING ERRCODE = 'check_violation';
  END IF;

  -- Validate: minimum age (16 years)
  IF dob_value > max_allowed_date THEN
    RAISE EXCEPTION 'You must be at least % years old to use our services', min_age
      USING ERRCODE = 'check_violation';
  END IF;

  -- Validate: maximum age (120 years - sanity check)
  IF dob_value < min_allowed_date THEN
    RAISE EXCEPTION 'Please enter a valid date of birth'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;