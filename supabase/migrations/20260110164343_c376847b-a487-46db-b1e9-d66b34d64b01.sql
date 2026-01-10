-- Add check constraint for minimum age 13 years on profiles.date_of_birth
-- Using a function to calculate age properly

CREATE OR REPLACE FUNCTION public.validate_minimum_age(dob date, min_age integer DEFAULT 13)
RETURNS boolean AS $$
BEGIN
  IF dob IS NULL THEN
    RETURN true; -- Allow NULL (optional field)
  END IF;
  RETURN (EXTRACT(YEAR FROM age(CURRENT_DATE, dob)) >= min_age);
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Create trigger function to validate DOB on insert/update
CREATE OR REPLACE FUNCTION public.enforce_minimum_age()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.date_of_birth IS NOT NULL AND NOT validate_minimum_age(NEW.date_of_birth, 13) THEN
    RAISE EXCEPTION 'Date of birth validation failed: minimum age is 13 years';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS enforce_dob_minimum_age ON public.profiles;

-- Create trigger on profiles table
CREATE TRIGGER enforce_dob_minimum_age
  BEFORE INSERT OR UPDATE OF date_of_birth ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_minimum_age();

-- Add unique constraint to promotion_redemptions to prevent duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'promotion_redemptions_unique_order'
  ) THEN
    ALTER TABLE public.promotion_redemptions
    ADD CONSTRAINT promotion_redemptions_unique_order 
    UNIQUE (promotion_id, order_id);
  END IF;
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;