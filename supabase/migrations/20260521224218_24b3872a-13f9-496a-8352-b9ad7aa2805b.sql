-- Storage policies for technician photo uploads under tech-photos/ prefix
-- Allows authenticated technicians to upload, and authenticated users (staff + clients) to read tech photos.

-- Allow any authenticated user (technician role) to insert objects in complaint-attachments under tech-photos/
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
    AND policyname='tech_photos_upload'
  ) THEN
    CREATE POLICY "tech_photos_upload"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'complaint-attachments'
      AND (storage.foldername(name))[1] = 'tech-photos'
      AND (
        public.has_role(auth.uid(), 'technician'::app_role)
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'employee'::app_role)
      )
    );
  END IF;
END $$;

-- Allow authenticated reads of tech-photos/ prefix (staff and the client themselves via app)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
    AND policyname='tech_photos_read_authenticated'
  ) THEN
    CREATE POLICY "tech_photos_read_authenticated"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'complaint-attachments'
      AND (storage.foldername(name))[1] = 'tech-photos'
    );
  END IF;
END $$;

-- Public read for tech-photos prefix only (so getPublicUrl works for emails/preview)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
    AND policyname='tech_photos_read_public'
  ) THEN
    CREATE POLICY "tech_photos_read_public"
    ON storage.objects
    FOR SELECT
    TO anon
    USING (
      bucket_id = 'complaint-attachments'
      AND (storage.foldername(name))[1] = 'tech-photos'
    );
  END IF;
END $$;