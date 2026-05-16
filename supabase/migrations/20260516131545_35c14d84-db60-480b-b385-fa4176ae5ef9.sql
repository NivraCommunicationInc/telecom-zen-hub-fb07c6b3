-- 1) live_chat_sessions: replace USING(true) with session-id header scope (or staff)
DROP POLICY IF EXISTS "Public can read own session by id" ON public.live_chat_sessions;
CREATE POLICY "Read own session or staff"
ON public.live_chat_sessions
FOR SELECT
USING (
  session_id = (current_setting('request.headers', true)::json ->> 'x-session-id')
  OR public.is_marketing_staff(auth.uid())
);

-- 2) live_chat_admin_replies: restrict reads to staff
DROP POLICY IF EXISTS "Public can read admin replies for session" ON public.live_chat_admin_replies;
CREATE POLICY "Staff read admin replies"
ON public.live_chat_admin_replies
FOR SELECT
USING (public.is_marketing_staff(auth.uid()));

-- 3) chat-attachments storage: require uploads under an existing session folder
DROP POLICY IF EXISTS "chat-attachments anyone upload" ON storage.objects;
CREATE POLICY "chat-attachments scoped upload"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND EXISTS (
    SELECT 1 FROM public.live_chat_sessions s
    WHERE s.session_id = (storage.foldername(name))[1]
  )
);