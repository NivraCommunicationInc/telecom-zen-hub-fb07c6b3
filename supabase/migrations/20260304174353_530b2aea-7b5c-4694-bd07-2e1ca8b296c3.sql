
CREATE OR REPLACE FUNCTION public.generate_kyc_case_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
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
