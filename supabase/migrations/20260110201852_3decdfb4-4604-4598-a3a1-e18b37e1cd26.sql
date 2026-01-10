-- 1) Create debug table for temporary logging
CREATE TABLE IF NOT EXISTS public.support_ticket_id_status_debug (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  raw_value text,
  normalized_value text,
  source text
);

-- 2) Enhanced guard trigger: normalize ANY value + force allowed set + log
CREATE OR REPLACE FUNCTION public.support_tickets_guard_id_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw text;
  norm text;
BEGIN
  raw := NEW.id_verification_status;
  norm := lower(trim(coalesce(NEW.id_verification_status, '')));

  -- Log ALWAYS for debugging (temporary)
  INSERT INTO public.support_ticket_id_status_debug(raw_value, normalized_value, source)
  VALUES (raw, norm, 'insert/update guard');

  -- Normalize empty to default
  IF norm = '' THEN
    norm := 'not_received';
  END IF;

  -- Force allowed values - NEVER fail, just normalize
  IF norm NOT IN ('not_received','received','verified','rejected') THEN
    norm := 'not_received';
  END IF;

  NEW.id_verification_status := norm;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_tickets_guard_id_status ON public.support_tickets;

CREATE TRIGGER trg_support_tickets_guard_id_status
BEFORE INSERT OR UPDATE OF id_verification_status
ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.support_tickets_guard_id_status();

-- 3) Clean existing invalid rows
UPDATE public.support_tickets
SET id_verification_status = 'not_received'
WHERE id_verification_status IS NULL
   OR trim(id_verification_status) = ''
   OR lower(trim(id_verification_status)) NOT IN ('not_received','received','verified','rejected');