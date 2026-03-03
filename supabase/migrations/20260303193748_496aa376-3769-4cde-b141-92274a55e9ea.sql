
-- Add selfie path, attempt tracking, retention columns
ALTER TABLE public.identity_verification_sessions 
  ADD COLUMN IF NOT EXISTS selfie_path text,
  ADD COLUMN IF NOT EXISTS submission_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS retention_delete_after timestamptz,
  ADD COLUMN IF NOT EXISTS client_ip text,
  ADD COLUMN IF NOT EXISTS client_user_agent text;

-- Set retention to 90 days after creation by default via trigger
CREATE OR REPLACE FUNCTION public.set_id_verification_retention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.retention_delete_after := NEW.created_at + interval '90 days';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_id_verification_retention ON public.identity_verification_sessions;
CREATE TRIGGER trg_set_id_verification_retention
  BEFORE INSERT ON public.identity_verification_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_id_verification_retention();

-- Make id-documents bucket private (ensure it exists and is NOT public)
UPDATE storage.buckets SET public = false WHERE id = 'id-documents';
