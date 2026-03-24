ALTER TABLE public.quotes
  ALTER COLUMN customer_user_id DROP NOT NULL;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS requires_identity_capture boolean NOT NULL DEFAULT false;

ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS quotes_identity_source_check;

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_identity_source_check
  CHECK (
    (is_prospect = true AND prospect_email IS NOT NULL)
    OR
    (is_prospect = false AND customer_user_id IS NOT NULL)
  );

UPDATE public.quotes
SET status = CASE
  WHEN checkout_completed_at IS NOT NULL OR checkout_status = 'completed' THEN 'checkout_completed'::public.quote_status
  WHEN checkout_status = 'in_progress' THEN 'checkout_in_progress'::public.quote_status
  ELSE 'accepted_pending_checkout'::public.quote_status
END
WHERE status = 'accepted'::public.quote_status;

UPDATE public.quotes
SET requires_identity_capture = true
WHERE is_prospect = true
  AND (
    COALESCE(NULLIF(TRIM(prospect_name), ''), '') = ''
    OR COALESCE(NULLIF(TRIM(prospect_phone), ''), '') = ''
  );

CREATE OR REPLACE FUNCTION public.normalize_quote_status_for_checkout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted'::public.quote_status THEN
    NEW.status := 'accepted_pending_checkout'::public.quote_status;
  END IF;

  IF NEW.status = 'accepted_pending_checkout'::public.quote_status THEN
    NEW.checkout_status := 'not_started';
  ELSIF NEW.status = 'checkout_in_progress'::public.quote_status THEN
    NEW.checkout_status := 'in_progress';
  ELSIF NEW.status IN ('checkout_completed'::public.quote_status, 'converted'::public.quote_status) THEN
    NEW.checkout_status := 'completed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_quote_status_for_checkout_trigger ON public.quotes;

CREATE TRIGGER normalize_quote_status_for_checkout_trigger
BEFORE INSERT OR UPDATE OF status ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.normalize_quote_status_for_checkout();