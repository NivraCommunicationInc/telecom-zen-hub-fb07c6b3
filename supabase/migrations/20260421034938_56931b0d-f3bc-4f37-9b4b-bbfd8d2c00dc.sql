-- 1. Table pending_document_jobs : queue de jobs PDF à générer côté navigateur
CREATE TABLE IF NOT EXISTS public.pending_document_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID,
  client_id UUID NOT NULL,
  doc_type TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  -- pending → claimed → generated → sent | failed
  claimed_by UUID,
  claimed_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  storage_path TEXT,
  client_auto_document_id UUID,
  recipient_email TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  last_error TEXT,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_doc_jobs_status_next
  ON public.pending_document_jobs(status, next_attempt_at)
  WHERE status IN ('pending', 'generated');
CREATE INDEX IF NOT EXISTS idx_pending_doc_jobs_account ON public.pending_document_jobs(account_id);
CREATE INDEX IF NOT EXISTS idx_pending_doc_jobs_client ON public.pending_document_jobs(client_id);

CREATE OR REPLACE FUNCTION public.update_pending_document_jobs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_pending_doc_jobs_updated_at ON public.pending_document_jobs;
CREATE TRIGGER trg_pending_doc_jobs_updated_at
  BEFORE UPDATE ON public.pending_document_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_pending_document_jobs_updated_at();

ALTER TABLE public.pending_document_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage doc jobs" ON public.pending_document_jobs;
CREATE POLICY "Staff manage doc jobs"
ON public.pending_document_jobs FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'employee') OR
  public.has_role(auth.uid(), 'billing_admin') OR
  public.has_role(auth.uid(), 'supervisor')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'employee') OR
  public.has_role(auth.uid(), 'billing_admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

DROP POLICY IF EXISTS "Deny anon doc jobs" ON public.pending_document_jobs;
CREATE POLICY "Deny anon doc jobs"
ON public.pending_document_jobs FOR ALL TO anon USING (false);

-- 2. RPC : claim_pending_document_job — atomique, prend le prochain job pending
CREATE OR REPLACE FUNCTION public.claim_pending_document_job(p_worker_id UUID DEFAULT NULL)
RETURNS public.pending_document_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job public.pending_document_jobs;
BEGIN
  -- Sécurité : seulement staff
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'employee') OR
    public.has_role(auth.uid(), 'billing_admin') OR
    public.has_role(auth.uid(), 'supervisor')
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE public.pending_document_jobs
  SET status = 'claimed',
      claimed_by = COALESCE(p_worker_id, auth.uid()),
      claimed_at = now(),
      attempts = attempts + 1
  WHERE id = (
    SELECT id FROM public.pending_document_jobs
    WHERE status = 'pending'
      AND next_attempt_at <= now()
      AND attempts < max_attempts
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_pending_document_job(UUID) TO authenticated;

-- 3. RPC : mark_document_job_generated — appelé par worker après upload Storage
CREATE OR REPLACE FUNCTION public.mark_document_job_generated(
  p_job_id UUID,
  p_storage_path TEXT,
  p_file_size_bytes INTEGER DEFAULT NULL,
  p_doc_number TEXT DEFAULT NULL
)
RETURNS public.pending_document_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job public.pending_document_jobs;
  v_doc_id UUID;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'employee') OR
    public.has_role(auth.uid(), 'billing_admin') OR
    public.has_role(auth.uid(), 'supervisor')
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_job FROM public.pending_document_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'job not found'; END IF;

  -- Crée l'entrée client_auto_documents
  INSERT INTO public.client_auto_documents (
    account_id, client_id, doc_type, doc_number, event_type,
    idempotency_key, storage_path, file_size_bytes,
    recipient_email, metadata
  ) VALUES (
    v_job.account_id, v_job.client_id, v_job.doc_type, p_doc_number, v_job.event_type,
    v_job.idempotency_key, p_storage_path, p_file_size_bytes,
    v_job.recipient_email, v_job.event_payload
  )
  ON CONFLICT (idempotency_key) DO UPDATE SET storage_path = EXCLUDED.storage_path
  RETURNING id INTO v_doc_id;

  UPDATE public.pending_document_jobs
  SET status = 'generated',
      generated_at = now(),
      storage_path = p_storage_path,
      client_auto_document_id = v_doc_id
  WHERE id = p_job_id
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_document_job_generated(UUID, TEXT, INTEGER, TEXT) TO authenticated;

-- 4. RPC : mark_document_job_failed — replanifie avec backoff
CREATE OR REPLACE FUNCTION public.mark_document_job_failed(
  p_job_id UUID,
  p_error TEXT
)
RETURNS public.pending_document_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job public.pending_document_jobs;
  v_backoff_seconds INTEGER;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'employee') OR
    public.has_role(auth.uid(), 'billing_admin') OR
    public.has_role(auth.uid(), 'supervisor')
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_job FROM public.pending_document_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'job not found'; END IF;

  -- Backoff exponentiel : 30s, 2min, 8min, 32min, 2h
  v_backoff_seconds := LEAST(POWER(4, v_job.attempts) * 30, 7200)::INTEGER;

  UPDATE public.pending_document_jobs
  SET status = CASE WHEN v_job.attempts >= v_job.max_attempts THEN 'failed' ELSE 'pending' END,
      claimed_by = NULL,
      claimed_at = NULL,
      last_error = p_error,
      next_attempt_at = now() + (v_backoff_seconds || ' seconds')::INTERVAL
  WHERE id = p_job_id
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_document_job_failed(UUID, TEXT) TO authenticated;

-- 5. RPC : enqueue_document_job — utilisé par triggers DB et code applicatif
CREATE OR REPLACE FUNCTION public.enqueue_document_job(
  p_account_id UUID,
  p_client_id UUID,
  p_doc_type TEXT,
  p_event_type TEXT,
  p_idempotency_key TEXT,
  p_recipient_email TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job_id UUID;
BEGIN
  INSERT INTO public.pending_document_jobs (
    account_id, client_id, doc_type, event_type,
    idempotency_key, recipient_email, event_payload
  ) VALUES (
    p_account_id, p_client_id, p_doc_type, p_event_type,
    p_idempotency_key, p_recipient_email, p_payload
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_document_job(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated, service_role;

-- 6. Realtime pour le worker
ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_document_jobs;