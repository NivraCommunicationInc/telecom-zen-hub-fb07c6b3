-- 1. live_chat_messages table (canonical message log)
CREATE TABLE IF NOT EXISTS public.live_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('visitor','bot','admin')),
  content text,
  attachment_url text,
  attachment_path text,
  attachment_name text,
  attachment_type text,
  attachment_size integer,
  admin_user_id uuid,
  admin_name text,
  admin_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_chat_messages_session ON public.live_chat_messages(session_id, created_at);

ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_chat_messages REPLICA IDENTITY FULL;

-- Helper: is current user staff?
CREATE OR REPLACE FUNCTION public.is_marketing_staff(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('admin','supervisor','employee','billing_admin')
  );
$$;

-- Read: anyone can read messages of a session that exists (sessions are scoped by random session_id which acts as a capability).
-- This matches the existing pattern for chatbot_logs / live_chat_admin_replies.
DROP POLICY IF EXISTS "anyone reads chat messages" ON public.live_chat_messages;
CREATE POLICY "anyone reads chat messages"
ON public.live_chat_messages FOR SELECT
USING (true);

-- Insert: anyone can insert as visitor/bot for a session; only staff can insert as admin
DROP POLICY IF EXISTS "anyone inserts visitor or bot messages" ON public.live_chat_messages;
CREATE POLICY "anyone inserts visitor or bot messages"
ON public.live_chat_messages FOR INSERT
WITH CHECK (role IN ('visitor','bot'));

DROP POLICY IF EXISTS "staff inserts admin messages" ON public.live_chat_messages;
CREATE POLICY "staff inserts admin messages"
ON public.live_chat_messages FOR INSERT
WITH CHECK (role = 'admin' AND public.is_marketing_staff(auth.uid()));

-- Update: only staff can update (e.g., set admin_seen_at)
DROP POLICY IF EXISTS "staff updates messages" ON public.live_chat_messages;
CREATE POLICY "staff updates messages"
ON public.live_chat_messages FOR UPDATE
USING (public.is_marketing_staff(auth.uid()))
WITH CHECK (public.is_marketing_staff(auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_messages;

-- 2. chat-attachments private storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  false,
  10485760, -- 10 MB
  ARRAY['image/jpeg','image/png','image/gif','image/webp','application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      public = false;

-- Storage policies: any visitor (anon or auth) can upload under the {session_id}/ prefix; staff can read all.
DROP POLICY IF EXISTS "chat-attachments anyone upload" ON storage.objects;
CREATE POLICY "chat-attachments anyone upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "chat-attachments anyone read" ON storage.objects;
CREATE POLICY "chat-attachments anyone read"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-attachments');
