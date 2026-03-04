
-- Create notification_outbox table for reliable transactional email delivery
CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  recipient text NOT NULL DEFAULT 'client',
  to_email text NOT NULL,
  to_name text,
  subject text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error_message text,
  retry_count int NOT NULL DEFAULT 0,
  entity_id text,
  entity_type text
);

-- Index for worker processing
CREATE INDEX IF NOT EXISTS idx_notification_outbox_status ON public.notification_outbox (status) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_notification_outbox_created ON public.notification_outbox (created_at DESC);

-- RLS: only service role can read/write (edge functions)
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

-- Trigger: when kyc_requested_documents status changes to 'uploaded', notify admin
CREATE OR REPLACE FUNCTION public.notify_admin_kyc_doc_uploaded()
RETURNS TRIGGER AS $$
DECLARE
  v_session RECORD;
  v_profile RECORD;
  v_admin_emails text[];
  v_doc_label text;
  v_email text;
BEGIN
  -- Only fire on status change to 'uploaded'
  IF NEW.status = 'uploaded' AND (OLD.status IS DISTINCT FROM 'uploaded') THEN
    -- Get session info
    SELECT s.case_number, s.user_id, s.id as session_id
    INTO v_session
    FROM public.identity_verification_sessions s
    WHERE s.id = NEW.kyc_session_id;

    IF v_session IS NULL THEN RETURN NEW; END IF;

    -- Get client profile
    SELECT p.full_name, p.email INTO v_profile
    FROM public.profiles p WHERE p.id = v_session.user_id;

    -- Get admin notification recipients
    SELECT email_recipients INTO v_admin_emails
    FROM public.admin_notification_settings
    WHERE setting_key = 'kyc_events' AND is_enabled = true
    LIMIT 1;

    -- Fallback to a default
    IF v_admin_emails IS NULL OR array_length(v_admin_emails, 1) IS NULL THEN
      v_admin_emails := ARRAY['support@nivra-telecom.ca'];
    END IF;

    v_doc_label := COALESCE(NEW.doc_type, 'document');

    -- Insert one outbox entry per admin recipient
    FOREACH v_email IN ARRAY v_admin_emails LOOP
      INSERT INTO public.notification_outbox (event_type, recipient, to_email, to_name, subject, payload_json, entity_id, entity_type)
      VALUES (
        'KYC_DOC_UPLOADED',
        'admin',
        v_email,
        'Admin Nivra',
        'Document KYC téléversé — ' || COALESCE(v_session.case_number, 'N/A') || ' — ' || COALESCE(v_profile.full_name, ''),
        jsonb_build_object(
          'case_number', v_session.case_number,
          'client_name', v_profile.full_name,
          'client_email', v_profile.email,
          'doc_type', v_doc_label,
          'session_id', v_session.session_id,
          'uploaded_at', NEW.uploaded_at
        ),
        v_session.session_id::text,
        'kyc_session'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_admin_kyc_doc_uploaded ON public.kyc_requested_documents;
CREATE TRIGGER trg_notify_admin_kyc_doc_uploaded
  AFTER UPDATE ON public.kyc_requested_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_kyc_doc_uploaded();

-- Ensure admin_notification_settings has a kyc_events row
INSERT INTO public.admin_notification_settings (setting_key, setting_label, category, is_enabled, email_recipients)
VALUES ('kyc_events', 'Événements KYC (documents, soumissions)', 'kyc', true, ARRAY['support@nivra-telecom.ca'])
ON CONFLICT (setting_key) DO NOTHING;
