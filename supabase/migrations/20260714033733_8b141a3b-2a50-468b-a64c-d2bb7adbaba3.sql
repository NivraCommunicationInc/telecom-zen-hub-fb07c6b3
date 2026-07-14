CREATE POLICY "tech_reads_own_intervention_media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'intervention-media' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(),'admin'::app_role)
  ));

CREATE POLICY "tech_uploads_own_intervention_media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'intervention-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "tech_deletes_own_intervention_media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'intervention-media' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(),'admin'::app_role)
  ));