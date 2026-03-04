
-- Add case_number and reference_code to identity_verification_sessions
ALTER TABLE public.identity_verification_sessions
  ADD COLUMN IF NOT EXISTS case_number TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS reference_code TEXT;

-- Create sequence for case numbers
CREATE SEQUENCE IF NOT EXISTS kyc_case_number_seq START 1;

-- Function to auto-generate case_number on insert
CREATE OR REPLACE FUNCTION public.generate_kyc_case_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  seq_val INT;
  year_str TEXT;
BEGIN
  seq_val := nextval('kyc_case_number_seq');
  year_str := to_char(NOW(), 'YYYY');
  NEW.case_number := 'KYC-' || year_str || '-' || LPAD(seq_val::TEXT, 6, '0');
  NEW.reference_code := LEFT(NEW.id::TEXT, 8);
  RETURN NEW;
END;
$$;

-- Trigger
DROP TRIGGER IF EXISTS trg_kyc_case_number ON public.identity_verification_sessions;
CREATE TRIGGER trg_kyc_case_number
  BEFORE INSERT ON public.identity_verification_sessions
  FOR EACH ROW
  WHEN (NEW.case_number IS NULL)
  EXECUTE FUNCTION public.generate_kyc_case_number();

-- Backfill existing rows without case_number
DO $$
DECLARE
  r RECORD;
  seq_val INT;
  year_str TEXT;
BEGIN
  FOR r IN SELECT id, created_at FROM public.identity_verification_sessions WHERE case_number IS NULL ORDER BY created_at ASC
  LOOP
    seq_val := nextval('kyc_case_number_seq');
    year_str := to_char(r.created_at, 'YYYY');
    UPDATE public.identity_verification_sessions
      SET case_number = 'KYC-' || year_str || '-' || LPAD(seq_val::TEXT, 6, '0'),
          reference_code = LEFT(r.id::TEXT, 8)
      WHERE id = r.id;
  END LOOP;
END;
$$;
