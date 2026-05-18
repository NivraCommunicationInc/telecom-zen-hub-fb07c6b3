-- Add language column to email_queue with auto-fill from profiles.preferred_language
ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'fr';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_queue_language_check'
  ) THEN
    ALTER TABLE public.email_queue
      ADD CONSTRAINT email_queue_language_check
      CHECK (language IN ('fr','en'));
  END IF;
END $$;

-- Auto-populate `language` on insert by looking up the recipient profile.
-- This covers all 30+ enqueue sites uniformly without touching any function.
CREATE OR REPLACE FUNCTION public.email_queue_set_language()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lang TEXT;
  v_uid  UUID;
BEGIN
  -- Respect explicit language value when caller sets one (other than default)
  IF NEW.language IS NOT NULL AND NEW.language IN ('fr','en')
     AND COALESCE((NEW.template_vars ->> '_lang_explicit')::boolean, false) THEN
    RETURN NEW;
  END IF;

  -- Try template_vars.client_user_id / user_id first
  v_uid := NULLIF(NEW.template_vars ->> 'client_user_id','')::uuid;
  IF v_uid IS NULL THEN
    v_uid := NULLIF(NEW.template_vars ->> 'user_id','')::uuid;
  END IF;

  IF v_uid IS NOT NULL THEN
    SELECT preferred_language INTO v_lang
    FROM public.profiles WHERE user_id = v_uid LIMIT 1;
  END IF;

  -- Fallback: match by recipient email
  IF v_lang IS NULL AND NEW.to_email IS NOT NULL THEN
    SELECT preferred_language INTO v_lang
    FROM public.profiles
    WHERE lower(email) = lower(NEW.to_email)
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_lang IN ('fr','en') THEN
    NEW.language := v_lang;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_queue_set_language ON public.email_queue;
CREATE TRIGGER trg_email_queue_set_language
  BEFORE INSERT ON public.email_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.email_queue_set_language();