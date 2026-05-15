INSERT INTO storage.buckets (id, name, public)
VALUES ('hub-media', 'hub-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "hub_media_public_read" ON storage.objects;
CREATE POLICY "hub_media_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'hub-media');

DROP POLICY IF EXISTS "hub_media_staff_insert" ON storage.objects;
CREATE POLICY "hub_media_staff_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'hub-media'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'supervisor'::app_role)
      OR has_role(auth.uid(), 'employee'::app_role)
    )
  );

DROP POLICY IF EXISTS "hub_media_staff_delete" ON storage.objects;
CREATE POLICY "hub_media_staff_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'hub-media' AND has_role(auth.uid(), 'admin'::app_role)
  );