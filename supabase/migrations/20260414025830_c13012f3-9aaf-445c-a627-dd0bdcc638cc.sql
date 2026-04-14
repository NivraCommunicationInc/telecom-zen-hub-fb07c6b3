-- ============================================
-- FIX 1: id-documents storage - restrict SELECT to own files
-- ============================================
DROP POLICY IF EXISTS "Users can read own ID docs" ON storage.objects;
CREATE POLICY "Users can read own ID docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'id-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Fix INSERT to authenticated only with path check
DROP POLICY IF EXISTS "Users can upload ID docs" ON storage.objects;
CREATE POLICY "Users can upload ID docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'id-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- FIX 2: quotes - remove overly permissive anon read policy
-- ============================================
DROP POLICY IF EXISTS "anon_read_quote_by_token" ON public.quotes;

-- ============================================
-- FIX 3: installation_jobs - restrict to staff roles only
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can read installation_jobs" ON public.installation_jobs;
CREATE POLICY "Staff can read installation_jobs"
ON public.installation_jobs FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'employee'::public.app_role)
);

-- Also fix installation_job_logs
DROP POLICY IF EXISTS "Authenticated users can read installation_job_logs" ON public.installation_job_logs;
CREATE POLICY "Staff can read installation_job_logs"
ON public.installation_job_logs FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'employee'::public.app_role)
);

-- ============================================
-- FIX 4: ticket-attachments storage - remove overly broad policy
-- ============================================
-- Drop the permissive policy that allows all authenticated users
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname ILIKE '%ticket attach%'
      AND qual::text ILIKE '%auth.uid()%is not null%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- ============================================
-- FIX 5: billing_system_alerts - restrict to staff
-- ============================================
DROP POLICY IF EXISTS "Staff can view billing alerts" ON public.billing_system_alerts;
CREATE POLICY "Staff can view billing alerts"
ON public.billing_system_alerts FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'employee'::public.app_role)
);

-- ============================================
-- FIX 6: employee_work_items - restrict INSERT to staff
-- ============================================
DROP POLICY IF EXISTS "Staff insert work items" ON public.employee_work_items;
CREATE POLICY "Staff insert work items"
ON public.employee_work_items FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'employee'::public.app_role)
);