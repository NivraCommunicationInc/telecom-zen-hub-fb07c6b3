
-- ============================================================
-- STORAGE BUCKET SECURITY HARDENING
-- ============================================================

-- 1. Make 'documents' bucket private (it stores ToS etc — read stays public but no listing)
UPDATE storage.buckets SET public = false WHERE id = 'documents';

-- 2. Fix ticket-attachments: require user folder path on INSERT
DROP POLICY IF EXISTS "Ticket attachments upload" ON storage.objects;
CREATE POLICY "Ticket attachments upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-attachments'
  AND (
    -- Users upload to ticket folder (staff manages paths)
    auth.uid() IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'employee'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.support_tickets st
        WHERE st.id::text = split_part(name, '/', 1)
        AND (st.owner_user_id = auth.uid() OR st.user_id = auth.uid())
      )
    )
  )
);

-- 3. Remove old overly permissive id-documents policies (anon insert from 20260303)
DROP POLICY IF EXISTS "Users can upload ID documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own ID documents" ON storage.objects;
-- The correct policies were already created in migration 20260414025830

-- 4. Remove old overly permissive ticket-attachments policies from early migrations
DROP POLICY IF EXISTS "Allow authenticated users to upload ticket attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view ticket attachments" ON storage.objects;

-- 5. Fix avatars listing: keep public SELECT but scope to specific files (not listing)
-- The bucket stays public for direct URL access, but we don't need to change SELECT
-- since avatars are intentionally publicly viewable profile pictures.
-- The linter warning is acceptable for avatars (public profile images).

-- 6. Ensure tax-documents and employment-letters buckets exist and are private
INSERT INTO storage.buckets (id, name, public)
VALUES ('tax-documents', 'tax-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('employment-letters', 'employment-letters', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Policies for tax-documents
DROP POLICY IF EXISTS "Staff manage tax documents" ON storage.objects;
CREATE POLICY "Staff manage tax documents"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'tax-documents'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'employee'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'tax-documents'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'employee'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Employees read own tax documents" ON storage.objects;
CREATE POLICY "Employees read own tax documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'tax-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policies for employment-letters
DROP POLICY IF EXISTS "Staff manage employment letters" ON storage.objects;
CREATE POLICY "Staff manage employment letters"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'employment-letters'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'employee'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'employment-letters'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'employee'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Employees read own employment letters" ON storage.objects;
CREATE POLICY "Employees read own employment letters"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'employment-letters'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 7. Add admin write policy for documents bucket
DROP POLICY IF EXISTS "Admin write documents" ON storage.objects;
CREATE POLICY "Admin write documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);
