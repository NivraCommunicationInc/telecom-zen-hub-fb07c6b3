-- ============================================================================
-- IDENTITY CORE LOCK: Trigger + profile_change_requests + RLS hardening
-- ============================================================================

-- 1) TRIGGER: Block client updates on identity fields
CREATE OR REPLACE FUNCTION fn_lock_identity_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee') THEN
    RETURN NEW;
  END IF;

  IF (
    COALESCE(NEW.first_name, '') IS DISTINCT FROM COALESCE(OLD.first_name, '') OR
    COALESCE(NEW.last_name, '') IS DISTINCT FROM COALESCE(OLD.last_name, '') OR
    COALESCE(NEW.date_of_birth::text, '') IS DISTINCT FROM COALESCE(OLD.date_of_birth::text, '') OR
    COALESCE(NEW.email, '') IS DISTINCT FROM COALESCE(OLD.email, '')
  ) THEN
    RAISE EXCEPTION 'IDENTITY_FIELD_LOCKED: Les champs identité (prénom, nom, date de naissance, email) ne peuvent être modifiés que par un administrateur. Veuillez contacter le support.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_identity_fields ON profiles;
CREATE TRIGGER trg_lock_identity_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION fn_lock_identity_fields();

-- 2) Tighten RLS: Replace permissive client update policy
DROP POLICY IF EXISTS "Client updates own profile" ON profiles;

CREATE POLICY "Client updates own contact fields"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3) Create profile_change_requests table
CREATE TABLE IF NOT EXISTS public.profile_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_changes jsonb NOT NULL,
  reason text,
  supporting_document_url text,
  status text NOT NULL DEFAULT 'submitted',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client reads own change requests"
  ON profile_change_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Client creates change requests"
  ON profile_change_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff manages change requests"
  ON profile_change_requests FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'employee')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'employee')
  );

CREATE POLICY "Block anon profile_change_requests"
  ON profile_change_requests AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION fn_update_profile_change_requests_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profile_change_requests_updated
  BEFORE UPDATE ON profile_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_profile_change_requests_timestamp();

-- 4) Guard: orders hydrate identity from profiles server-side
CREATE OR REPLACE FUNCTION fn_hydrate_order_identity_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  IF NEW.created_by = 'client' AND NEW.user_id IS NOT NULL THEN
    SELECT first_name, last_name, date_of_birth, email, phone
    INTO v_profile
    FROM public.profiles
    WHERE user_id = NEW.user_id;

    IF FOUND THEN
      IF v_profile.first_name IS NOT NULL THEN
        NEW.client_first_name := v_profile.first_name;
      END IF;
      IF v_profile.last_name IS NOT NULL THEN
        NEW.client_last_name := v_profile.last_name;
      END IF;
      IF v_profile.email IS NOT NULL THEN
        NEW.client_email := v_profile.email;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hydrate_order_identity ON orders;
CREATE TRIGGER trg_hydrate_order_identity
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_hydrate_order_identity_from_profile();