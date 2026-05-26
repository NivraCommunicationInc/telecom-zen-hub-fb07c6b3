CREATE OR REPLACE FUNCTION public.email_queue_fill_missing_event_key()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;

  IF NEW.event_key IS NULL OR btrim(NEW.event_key) = '' THEN
    NEW.event_key := 'manual_queue_' || NEW.id::text;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_00_email_queue_fill_missing_event_key ON public.email_queue;
CREATE TRIGGER trg_00_email_queue_fill_missing_event_key
BEFORE INSERT ON public.email_queue
FOR EACH ROW
EXECUTE FUNCTION public.email_queue_fill_missing_event_key();