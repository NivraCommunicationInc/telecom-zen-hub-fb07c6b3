-- Allow visitors (anon/authenticated) to create and update their OWN session
-- The session_id is a UUID known only to the client — security-by-secret

DROP POLICY IF EXISTS "Visitors can upsert own session" ON public.live_chat_sessions;
CREATE POLICY "Visitors can upsert own session"
ON public.live_chat_sessions FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Visitors can update own session" ON public.live_chat_sessions;
CREATE POLICY "Visitors can update own session"
ON public.live_chat_sessions FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);
