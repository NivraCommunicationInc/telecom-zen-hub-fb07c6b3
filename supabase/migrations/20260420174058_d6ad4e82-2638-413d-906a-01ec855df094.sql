-- Create phone-photos storage bucket (public read, internal-staff write)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'phone-photos',
  'phone-photos',
  true,
  10485760, -- 10 MB
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 10485760,
      allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif'];

-- Public can read (photos shown on /telephones)
DROP POLICY IF EXISTS "phone_photos_public_read" ON storage.objects;
CREATE POLICY "phone_photos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'phone-photos');

-- Only internal staff can upload/update/delete
DROP POLICY IF EXISTS "phone_photos_staff_insert" ON storage.objects;
CREATE POLICY "phone_photos_staff_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'phone-photos'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_role(auth.uid(), 'employee'::app_role)
    OR public.has_role(auth.uid(), 'billing_admin'::app_role)
  )
);

DROP POLICY IF EXISTS "phone_photos_staff_update" ON storage.objects;
CREATE POLICY "phone_photos_staff_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'phone-photos'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_role(auth.uid(), 'employee'::app_role)
    OR public.has_role(auth.uid(), 'billing_admin'::app_role)
  )
);

DROP POLICY IF EXISTS "phone_photos_staff_delete" ON storage.objects;
CREATE POLICY "phone_photos_staff_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'phone-photos'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_role(auth.uid(), 'employee'::app_role)
    OR public.has_role(auth.uid(), 'billing_admin'::app_role)
  )
);