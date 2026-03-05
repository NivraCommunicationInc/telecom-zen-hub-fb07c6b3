
-- =====================================================
-- FIX #2: identity_documents table (DB source of truth)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.identity_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_session_id uuid NOT NULL REFERENCES public.identity_verification_sessions(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('front', 'back', 'selfie')),
  storage_bucket text NOT NULL DEFAULT 'id-documents',
  object_path text NOT NULL,
  checksum text,
  file_size bigint,
  content_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_identity_documents_session ON public.identity_documents(kyc_session_id);
CREATE UNIQUE INDEX idx_identity_documents_unique ON public.identity_documents(kyc_session_id, doc_type);

ALTER TABLE public.identity_documents ENABLE ROW LEVEL SECURITY;

-- Authenticated users can see their own docs (via session ownership)
CREATE POLICY "Users can view own identity documents"
  ON public.identity_documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.identity_verification_sessions s
      WHERE s.id = identity_documents.kyc_session_id
        AND s.user_id = auth.uid()
    )
  );

-- Staff can view all docs
CREATE POLICY "Staff can view all identity documents"
  ON public.identity_documents FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'kyc_agent')
    OR public.has_role(auth.uid(), 'supervisor')
    OR public.has_role(auth.uid(), 'support')
  );

-- Service role inserts (edge function)
CREATE POLICY "Service role can insert identity documents"
  ON public.identity_documents FOR INSERT TO service_role
  WITH CHECK (true);

-- =====================================================
-- FIX #3: get_kyc_document_urls RPC (SECURITY DEFINER)
-- Returns docs metadata for a session; admin generates signed URLs client-side
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_kyc_document_urls(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  -- Caller must be staff or the session owner
  IF NOT (
    has_role(v_caller_id, 'kyc_agent')
    OR has_role(v_caller_id, 'supervisor')
    OR has_role(v_caller_id, 'support')
    OR EXISTS (SELECT 1 FROM identity_verification_sessions WHERE id = p_session_id AND user_id = v_caller_id)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Try identity_documents first (new table)
  SELECT jsonb_agg(jsonb_build_object(
    'doc_type', d.doc_type,
    'storage_bucket', d.storage_bucket,
    'object_path', d.object_path,
    'created_at', d.created_at
  ))
  INTO v_result
  FROM identity_documents d
  WHERE d.kyc_session_id = p_session_id;

  -- Fallback to legacy paths on session if no rows in identity_documents
  IF v_result IS NULL THEN
    SELECT jsonb_agg(doc) INTO v_result
    FROM (
      SELECT jsonb_build_object(
        'doc_type', t.doc_type,
        'storage_bucket', 'id-documents',
        'object_path', t.path,
        'created_at', s.submitted_at
      ) AS doc
      FROM identity_verification_sessions s,
      LATERAL (
        VALUES ('front', s.document_front_path), ('back', s.document_back_path), ('selfie', s.selfie_path)
      ) AS t(doc_type, path)
      WHERE s.id = p_session_id AND t.path IS NOT NULL
    ) sub;
  END IF;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- =====================================================
-- FIX #4: approve_kyc_session RPC (SECURITY DEFINER)
-- Transactional decision: approve/reject with audit
-- =====================================================
CREATE OR REPLACE FUNCTION public.approve_kyc_session(
  p_session_id uuid,
  p_decision text,       -- 'approved' or 'rejected'
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_session record;
  v_order_id uuid;
  v_now timestamptz := now();
BEGIN
  -- Validate caller role
  IF NOT (
    has_role(v_caller_id, 'kyc_agent')
    OR has_role(v_caller_id, 'supervisor')
  ) THEN
    -- Log failed attempt
    INSERT INTO identity_verification_events (session_id, event_type, actor_id, actor_role, details)
    VALUES (p_session_id, 'decision_denied', v_caller_id, 'unauthorized',
      jsonb_build_object('reason', 'caller lacks kyc_agent or supervisor role'));
    RAISE EXCEPTION 'Access denied: insufficient role for KYC decisions';
  END IF;

  -- Validate decision
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision: must be approved or rejected';
  END IF;

  -- Lock and fetch session
  SELECT * INTO v_session
  FROM identity_verification_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found: %', p_session_id;
  END IF;

  -- Prevent re-deciding finalized sessions
  IF v_session.status IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Session already finalized with status: %', v_session.status;
  END IF;

  -- Update session
  UPDATE identity_verification_sessions
  SET status = p_decision,
      reviewed_by = v_caller_id,
      reviewed_at = v_now,
      admin_notes = COALESCE(p_note, admin_notes),
      retention_status = CASE WHEN p_decision = 'approved' THEN 'locked' ELSE retention_status END
  WHERE id = p_session_id;

  -- Get linked order
  SELECT order_id INTO v_order_id FROM identity_verification_sessions WHERE id = p_session_id;

  -- Update order id_verification_status if linked
  IF v_order_id IS NOT NULL THEN
    UPDATE orders
    SET id_verification_status = CASE WHEN p_decision = 'approved' THEN 'verified' ELSE 'rejected' END
    WHERE id = v_order_id;
  END IF;

  -- Audit event
  INSERT INTO identity_verification_events (session_id, event_type, actor_id, actor_role, details)
  VALUES (
    p_session_id,
    'decision_' || p_decision,
    v_caller_id,
    'staff',
    jsonb_build_object(
      'decision', p_decision,
      'note', p_note,
      'order_id', v_order_id,
      'previous_status', v_session.status
    )
  );

  RETURN jsonb_build_object(
    'session_id', p_session_id,
    'status', p_decision,
    'order_id', v_order_id,
    'reviewed_at', v_now
  );
END;
$$;
