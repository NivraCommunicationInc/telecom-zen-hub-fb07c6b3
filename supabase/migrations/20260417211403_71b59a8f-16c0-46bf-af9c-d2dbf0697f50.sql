-- Create public bucket for installation guides
INSERT INTO storage.buckets (id, name, public)
VALUES ('installation-guides', 'installation-guides', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read policy on installation-guides
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Public read installation-guides'
  ) THEN
    CREATE POLICY "Public read installation-guides"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'installation-guides');
  END IF;
END $$;

-- Service role write policy (handled implicitly, but explicit for admin uploads)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Admins manage installation-guides'
  ) THEN
    CREATE POLICY "Admins manage installation-guides"
      ON storage.objects FOR ALL
      USING (bucket_id = 'installation-guides' AND public.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (bucket_id = 'installation-guides' AND public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;