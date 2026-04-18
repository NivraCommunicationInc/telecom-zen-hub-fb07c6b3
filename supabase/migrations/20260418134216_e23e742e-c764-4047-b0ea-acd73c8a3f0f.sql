DROP POLICY IF EXISTS "chat-attachments anyone read" ON storage.objects;
CREATE POLICY "chat-attachments staff read"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-attachments' AND public.is_marketing_staff(auth.uid()));
