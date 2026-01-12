-- =============================================
-- WEB FORM INBOX SYSTEM - Data Model
-- =============================================

-- A) web_form_threads - Main conversation threads
CREATE TABLE public.web_form_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','open','pending','closed','spam')),
  subject TEXT NOT NULL DEFAULT 'Formulaire Web',
  thread_number TEXT UNIQUE,
  contact_full_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  page_url TEXT,
  is_linked_client BOOLEAN NOT NULL DEFAULT false,
  linked_user_id UUID,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sender_type TEXT CHECK (last_sender_type IN ('contact','admin','client')),
  admin_assignee_user_id UUID,
  admin_tags TEXT[]
);

-- B) web_form_messages - Individual messages in threads
CREATE TABLE public.web_form_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.web_form_threads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('contact','admin','client','system')),
  sender_email TEXT,
  sender_name TEXT,
  body_text TEXT NOT NULL,
  body_html TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  email_message_id TEXT,
  email_in_reply_to TEXT,
  raw_email_payload JSONB,
  is_internal_note BOOLEAN NOT NULL DEFAULT false
);

-- C) web_form_email_map - Reply token routing
CREATE TABLE public.web_form_email_map (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.web_form_threads(id) ON DELETE CASCADE,
  reply_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_web_form_threads_contact_email ON public.web_form_threads(contact_email);
CREATE INDEX idx_web_form_threads_status_last_message ON public.web_form_threads(status, last_message_at DESC);
CREATE INDEX idx_web_form_threads_linked_user ON public.web_form_threads(linked_user_id) WHERE linked_user_id IS NOT NULL;
CREATE INDEX idx_web_form_messages_thread_created ON public.web_form_messages(thread_id, created_at);
CREATE INDEX idx_web_form_email_map_token ON public.web_form_email_map(reply_token);

-- =============================================
-- THREAD NUMBER GENERATION
-- =============================================
CREATE OR REPLACE FUNCTION public.generate_web_form_thread_number()
RETURNS TRIGGER AS $$
DECLARE
  date_part TEXT;
  seq_part TEXT;
  next_seq INT;
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(thread_number FROM 'WF-\d{8}-(\d+)') AS INT)
  ), 0) + 1
  INTO next_seq
  FROM public.web_form_threads
  WHERE thread_number LIKE 'WF-' || date_part || '-%';
  
  seq_part := LPAD(next_seq::TEXT, 4, '0');
  NEW.thread_number := 'WF-' || date_part || '-' || seq_part;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_web_form_thread_number
  BEFORE INSERT ON public.web_form_threads
  FOR EACH ROW
  WHEN (NEW.thread_number IS NULL)
  EXECUTE FUNCTION public.generate_web_form_thread_number();

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================
CREATE TRIGGER update_web_form_threads_updated_at
  BEFORE UPDATE ON public.web_form_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE public.web_form_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_form_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_form_email_map ENABLE ROW LEVEL SECURITY;

-- Threads: Clients can only see their linked threads
CREATE POLICY "Clients can view their linked threads"
  ON public.web_form_threads
  FOR SELECT
  USING (linked_user_id = auth.uid());

-- Messages: Clients can only see messages in their linked threads (excluding internal notes)
CREATE POLICY "Clients can view messages in their threads"
  ON public.web_form_messages
  FOR SELECT
  USING (
    is_internal_note = false
    AND EXISTS (
      SELECT 1 FROM public.web_form_threads t
      WHERE t.id = thread_id AND t.linked_user_id = auth.uid()
    )
  );

-- No direct inserts from clients - all go through Edge Functions
-- Admin access is via service_role in Edge Functions