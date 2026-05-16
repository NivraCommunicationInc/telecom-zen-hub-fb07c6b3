-- =====================================================================
-- 1. Schema: add per-user/per-code salt columns
-- =====================================================================
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS admin_pin_salt text;

ALTER TABLE public.staff_otp_codes
  ADD COLUMN IF NOT EXISTS code_salt text;

-- =====================================================================
-- 2. Force PIN resets (clear legacy SHA-256 hashes)
-- =====================================================================
UPDATE public.user_roles
   SET admin_pin_hash = NULL,
       admin_pin_salt = NULL,
       require_pin_change = true,
       require_password_change = true
 WHERE role = 'admin'
   AND admin_pin_hash IS NOT NULL;

UPDATE public.employees
   SET pin_hash = '',
       pin_salt = NULL,
       require_pin_change = true,
       failed_login_attempts = 0,
       lockout_until = NULL
 WHERE pin_hash IS NOT NULL;

-- Invalidate any outstanding OTPs since hashing changes
UPDATE public.staff_otp_codes
   SET used = true
 WHERE used = false;

-- =====================================================================
-- 3. Fix always-true RLS policies
-- =====================================================================

-- identity_documents: service-role only for writes
DROP POLICY IF EXISTS service_role_update_identity_docs ON public.identity_documents;
DROP POLICY IF EXISTS service_role_delete_identity_docs ON public.identity_documents;
DROP POLICY IF EXISTS service_role_insert_identity_docs ON public.identity_documents;

CREATE POLICY service_role_insert_identity_docs
  ON public.identity_documents
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY service_role_update_identity_docs
  ON public.identity_documents
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY service_role_delete_identity_docs
  ON public.identity_documents
  FOR DELETE
  TO service_role
  USING (true);

-- overdue_reminder_log: service-role only
DROP POLICY IF EXISTS "Service role inserts reminder logs" ON public.overdue_reminder_log;
CREATE POLICY "Service role inserts reminder logs"
  ON public.overdue_reminder_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- transaction_events: service-role only
DROP POLICY IF EXISTS "Service role can insert events" ON public.transaction_events;
CREATE POLICY "Service role can insert events"
  ON public.transaction_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- field_commissions: tighten WITH CHECK to mirror USING
DROP POLICY IF EXISTS "Staff update commissions" ON public.field_commissions;
CREATE POLICY "Staff update commissions"
  ON public.field_commissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.status = 'active'
        AND user_roles.is_active = true
        AND (user_roles.can_access_core = true OR user_roles.can_access_employee = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.status = 'active'
        AND user_roles.is_active = true
        AND (user_roles.can_access_core = true OR user_roles.can_access_employee = true)
    )
  );

-- =====================================================================
-- 4. Public bucket listing: restrict hub-media listing to staff,
--    keep direct file URLs publicly accessible via Supabase public URL.
-- =====================================================================
DROP POLICY IF EXISTS hub_media_public_read ON storage.objects;
CREATE POLICY hub_media_staff_list
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'hub-media'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'employee')
      OR public.has_role(auth.uid(), 'supervisor')
      OR public.has_role(auth.uid(), 'billing_admin')
    )
  );

-- =====================================================================
-- 5. Mass-set search_path = public on every public function and
--    revoke EXECUTE from anon (keeps authenticated + service_role).
-- =====================================================================
DO $mig$
DECLARE
  r record;
  sig text;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prokind = 'f'
  LOOP
    sig := format('%I.%I(%s)', r.schema_name, r.function_name, r.args);
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', sig);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skip search_path on %: %', sig, SQLERRM;
    END;
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', sig);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skip revoke on %: %', sig, SQLERRM;
    END;
  END LOOP;
END
$mig$;