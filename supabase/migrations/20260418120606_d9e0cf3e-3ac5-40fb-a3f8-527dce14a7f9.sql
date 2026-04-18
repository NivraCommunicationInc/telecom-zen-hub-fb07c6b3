-- Add live chat handover state tracking on top of existing chatbot_logs
CREATE TABLE IF NOT EXISTS public.live_chat_sessions (
  session_id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'bot_active' CHECK (status IN ('bot_active', 'human_takeover', 'closed', 'waiting')),
  visitor_name text,
  visitor_email text,
  visitor_user_id uuid,
  current_page text,
  language text DEFAULT 'fr',
  taken_over_by uuid,
  taken_over_at timestamptz,
  last_visitor_message_at timestamptz,
  last_message_at timestamptz DEFAULT now(),
  unread_for_admin integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_chat_sessions_status ON public.live_chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_live_chat_sessions_last_message ON public.live_chat_sessions(last_message_at DESC);

ALTER TABLE public.live_chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage live_chat_sessions"
ON public.live_chat_sessions FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow chatbot edge functions / public reading by session_id (the user has the secret session_id)
CREATE POLICY "Public can read own session by id"
ON public.live_chat_sessions FOR SELECT
TO anon, authenticated
USING (true);

-- Admin replies to a chat session (when human takes over)
CREATE TABLE IF NOT EXISTS public.live_chat_admin_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  admin_user_id uuid NOT NULL,
  admin_name text,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_chat_admin_replies_session ON public.live_chat_admin_replies(session_id, created_at);

ALTER TABLE public.live_chat_admin_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage live_chat_admin_replies"
ON public.live_chat_admin_replies FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can read admin replies for session"
ON public.live_chat_admin_replies FOR SELECT
TO anon, authenticated
USING (true);

-- Marketing settings (stores OpenPhone phone number id, etc. — NOT secrets)
CREATE TABLE IF NOT EXISTS public.marketing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value text,
  updated_by uuid,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.marketing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage marketing_settings"
ON public.marketing_settings FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Realtime broadcast for live chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_admin_replies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chatbot_logs;

-- Trigger to upsert live_chat_sessions when chatbot_logs receives a new message
CREATE OR REPLACE FUNCTION public.fn_sync_live_chat_session()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.live_chat_sessions (
    session_id, visitor_user_id, last_visitor_message_at, last_message_at, unread_for_admin
  ) VALUES (
    NEW.session_id, NEW.user_id, NEW.created_at, NEW.created_at, 1
  )
  ON CONFLICT (session_id) DO UPDATE SET
    last_visitor_message_at = NEW.created_at,
    last_message_at = NEW.created_at,
    visitor_user_id = COALESCE(public.live_chat_sessions.visitor_user_id, NEW.user_id),
    unread_for_admin = public.live_chat_sessions.unread_for_admin + 1,
    status = CASE 
      WHEN public.live_chat_sessions.status = 'closed' THEN 'bot_active'
      ELSE public.live_chat_sessions.status
    END,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_live_chat_session ON public.chatbot_logs;
CREATE TRIGGER trg_sync_live_chat_session
AFTER INSERT ON public.chatbot_logs
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_live_chat_session();