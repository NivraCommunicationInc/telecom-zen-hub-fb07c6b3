-- ============================================================================
-- Migration: Add account_number to profiles with secure ID generation (2-9)
-- ============================================================================

-- 1. Add account_number column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS account_number TEXT;

-- 2. Create sequence for account numbers (starting at 200000 to ensure 2-9 first digit)
CREATE SEQUENCE IF NOT EXISTS public.account_number_seq 
START WITH 200001 
INCREMENT BY 1 
MINVALUE 200001 
MAXVALUE 999999
NO CYCLE;

-- 3. Function to generate secure account number (6 digits, first digit 2-9)
CREATE OR REPLACE FUNCTION public.generate_secure_account_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_val BIGINT;
  first_digit INT;
  remaining TEXT;
  result TEXT;
BEGIN
  -- Get next sequence value
  next_val := nextval('public.account_number_seq');
  
  -- If we've cycled through, generate random
  IF next_val > 999999 THEN
    -- Generate random 6-digit number starting with 2-9
    first_digit := floor(random() * 8 + 2)::INT; -- 2-9
    remaining := lpad(floor(random() * 100000)::TEXT, 5, '0');
    result := first_digit::TEXT || remaining;
  ELSE
    result := next_val::TEXT;
  END IF;
  
  -- Ensure first digit is 2-9 (guard)
  IF LEFT(result, 1) IN ('0', '1') THEN
    first_digit := floor(random() * 8 + 2)::INT;
    result := first_digit::TEXT || RIGHT(result, 5);
  END IF;
  
  RETURN result;
END;
$$;

-- 4. Trigger function to auto-generate account_number on profile creation
CREATE OR REPLACE FUNCTION public.trg_set_profile_account_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only generate if account_number is NULL or empty
  IF NEW.account_number IS NULL OR NEW.account_number = '' THEN
    NEW.account_number := generate_secure_account_number();
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Create trigger on profiles
DROP TRIGGER IF EXISTS trg_profile_account_number ON public.profiles;
CREATE TRIGGER trg_profile_account_number
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_set_profile_account_number();

-- 6. Backfill existing profiles with account numbers
UPDATE public.profiles
SET account_number = generate_secure_account_number()
WHERE account_number IS NULL OR account_number = '';

-- 7. Add unique constraint on account_number
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_account_number_unique;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_account_number_unique UNIQUE (account_number);

-- 8. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_account_number 
ON public.profiles(account_number);

-- 9. Add comment for documentation
COMMENT ON COLUMN public.profiles.account_number IS 
'Unique 6-digit account number. First digit always 2-9 (never 0 or 1). Auto-generated on profile creation.';