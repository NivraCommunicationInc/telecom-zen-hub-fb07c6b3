-- STEP 1: Normalize any existing invalid rows
UPDATE public.support_tickets
SET id_verification_status = 'not_received'
WHERE id_verification_status IS NULL OR id_verification_status = '';

-- STEP 2: Set NOT NULL constraint (default already exists)
ALTER TABLE public.support_tickets
  ALTER COLUMN id_verification_status SET NOT NULL;

-- STEP 3: Guard trigger to auto-fix empty/null values on insert/update
CREATE OR REPLACE FUNCTION public.support_tickets_guard_id_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id_verification_status IS NULL OR NEW.id_verification_status = '' THEN
    NEW.id_verification_status := 'not_received';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_tickets_guard_id_status ON public.support_tickets;

CREATE TRIGGER trg_support_tickets_guard_id_status
BEFORE INSERT OR UPDATE OF id_verification_status
ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.support_tickets_guard_id_status();