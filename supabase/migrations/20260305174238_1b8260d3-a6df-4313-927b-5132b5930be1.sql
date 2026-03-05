
-- ============================================================================
-- IDENTITY VERIFIED FLAG + ONE-TIME-SET TRIGGER
-- ============================================================================

-- 1) Add identity_verified columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS identity_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_verified_at timestamptz;

-- 2) Backfill: any profile with a non-null date_of_birth AND first_name AND last_name = verified
UPDATE public.profiles
SET 
  identity_verified = true,
  identity_verified_at = COALESCE(updated_at, created_at, now())
WHERE 
  date_of_birth IS NOT NULL 
  AND first_name IS NOT NULL 
  AND first_name != ''
  AND last_name IS NOT NULL 
  AND last_name != '';

-- 3) Replace trigger: enhanced one-time-set logic
CREATE OR REPLACE FUNCTION fn_lock_identity_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins/employees bypass all locks
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee') THEN
    RETURN NEW;
  END IF;

  -- If identity is already verified, block ALL identity field changes
  IF OLD.identity_verified = true THEN
    IF (
      COALESCE(NEW.first_name, '') IS DISTINCT FROM COALESCE(OLD.first_name, '') OR
      COALESCE(NEW.last_name, '') IS DISTINCT FROM COALESCE(OLD.last_name, '') OR
      COALESCE(NEW.date_of_birth::text, '') IS DISTINCT FROM COALESCE(OLD.date_of_birth::text, '') OR
      COALESCE(NEW.email, '') IS DISTINCT FROM COALESCE(OLD.email, '')
    ) THEN
      RAISE EXCEPTION 'IDENTITY_FIELD_LOCKED: Les champs identité ne peuvent être modifiés que par un administrateur. Veuillez contacter le support.';
    END IF;
    -- Prevent client from unsetting identity_verified
    NEW.identity_verified := OLD.identity_verified;
    NEW.identity_verified_at := OLD.identity_verified_at;
    RETURN NEW;
  END IF;

  -- Identity NOT yet verified: allow one-time set (NULL -> value), block overwrite (value -> different value)
  IF OLD.first_name IS NOT NULL AND OLD.first_name != '' AND
     COALESCE(NEW.first_name, '') IS DISTINCT FROM COALESCE(OLD.first_name, '') THEN
    RAISE EXCEPTION 'IDENTITY_FIELD_LOCKED: Le prénom a déjà été défini et ne peut plus être modifié.';
  END IF;

  IF OLD.last_name IS NOT NULL AND OLD.last_name != '' AND
     COALESCE(NEW.last_name, '') IS DISTINCT FROM COALESCE(OLD.last_name, '') THEN
    RAISE EXCEPTION 'IDENTITY_FIELD_LOCKED: Le nom a déjà été défini et ne peut plus être modifié.';
  END IF;

  IF OLD.date_of_birth IS NOT NULL AND
     COALESCE(NEW.date_of_birth::text, '') IS DISTINCT FROM COALESCE(OLD.date_of_birth::text, '') THEN
    RAISE EXCEPTION 'IDENTITY_FIELD_LOCKED: La date de naissance a déjà été définie et ne peut plus être modifiée.';
  END IF;

  IF OLD.email IS NOT NULL AND OLD.email != '' AND
     COALESCE(NEW.email, '') IS DISTINCT FROM COALESCE(OLD.email, '') THEN
    RAISE EXCEPTION 'IDENTITY_FIELD_LOCKED: L''email a déjà été défini et ne peut plus être modifié.';
  END IF;

  -- Auto-verify if all identity fields are now set
  IF NEW.first_name IS NOT NULL AND NEW.first_name != '' AND
     NEW.last_name IS NOT NULL AND NEW.last_name != '' AND
     NEW.date_of_birth IS NOT NULL THEN
    NEW.identity_verified := true;
    NEW.identity_verified_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_identity_fields ON profiles;
CREATE TRIGGER trg_lock_identity_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION fn_lock_identity_fields();
