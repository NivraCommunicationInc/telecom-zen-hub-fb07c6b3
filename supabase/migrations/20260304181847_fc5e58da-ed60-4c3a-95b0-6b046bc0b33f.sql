
-- Create kyc_requested_documents table
CREATE TABLE public.kyc_requested_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_session_id uuid NOT NULL REFERENCES public.identity_verification_sessions(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  instructions text,
  status text NOT NULL DEFAULT 'requested',
  requested_by_admin_id uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  uploaded_file_url text,
  uploaded_at timestamptz,
  reviewed_by_admin_id uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by session
CREATE INDEX idx_kyc_requested_docs_session ON public.kyc_requested_documents(kyc_session_id);
CREATE INDEX idx_kyc_requested_docs_status ON public.kyc_requested_documents(status);

-- Enable RLS
ALTER TABLE public.kyc_requested_documents ENABLE ROW LEVEL SECURITY;

-- Admin can do everything (via service role in edge functions)
-- Client can read their own docs and update uploaded_file_url
CREATE POLICY "Users can view their own requested docs"
  ON public.kyc_requested_documents
  FOR SELECT
  TO authenticated
  USING (
    kyc_session_id IN (
      SELECT id FROM public.identity_verification_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update upload fields on their own docs"
  ON public.kyc_requested_documents
  FOR UPDATE
  TO authenticated
  USING (
    kyc_session_id IN (
      SELECT id FROM public.identity_verification_sessions WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    kyc_session_id IN (
      SELECT id FROM public.identity_verification_sessions WHERE user_id = auth.uid()
    )
  );

-- Admin users full access via admin_users check
CREATE POLICY "Admin full access to kyc_requested_documents"
  ON public.kyc_requested_documents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
  );

-- Auto-update trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_kyc_requested_docs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kyc_requested_docs_updated_at
  BEFORE UPDATE ON public.kyc_requested_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_kyc_requested_docs_updated_at();

-- Auto-transition: when all requested docs are uploaded, set session to submitted
CREATE OR REPLACE FUNCTION public.auto_transition_kyc_on_upload()
RETURNS TRIGGER AS $$
DECLARE
  pending_count integer;
  session_status text;
BEGIN
  IF NEW.status = 'uploaded' AND (OLD.status IS NULL OR OLD.status = 'requested' OR OLD.status = 'rejected') THEN
    SELECT count(*) INTO pending_count
    FROM public.kyc_requested_documents
    WHERE kyc_session_id = NEW.kyc_session_id
      AND status IN ('requested', 'rejected');

    IF pending_count = 0 THEN
      SELECT status INTO session_status
      FROM public.identity_verification_sessions
      WHERE id = NEW.kyc_session_id;

      IF session_status = 'pending_docs' THEN
        UPDATE public.identity_verification_sessions
        SET status = 'submitted', updated_at = now()
        WHERE id = NEW.kyc_session_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_transition_kyc_on_upload
  AFTER UPDATE ON public.kyc_requested_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_transition_kyc_on_upload();
