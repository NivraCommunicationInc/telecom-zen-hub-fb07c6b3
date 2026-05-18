
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS work_city TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-photos', 'agent-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Agent photos public read" ON storage.objects;
CREATE POLICY "Agent photos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'agent-photos');

DROP POLICY IF EXISTS "Agents upload own photo" ON storage.objects;
CREATE POLICY "Agents upload own photo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'agent-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Agents update own photo" ON storage.objects;
CREATE POLICY "Agents update own photo"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'agent-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Agents delete own photo" ON storage.objects;
CREATE POLICY "Agents delete own photo"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'agent-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
