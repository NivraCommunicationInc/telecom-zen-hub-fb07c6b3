-- Permettre au worker serveur (service_role, sans auth.uid()) de réclamer et marquer les jobs PDF.
-- Sans ce changement, le cron job process-document-jobs échoue avec "unauthorized" car la RPC
-- exigeait un rôle staff via has_role(auth.uid(), ...) — mais auth.uid() est NULL côté service_role.

CREATE OR REPLACE FUNCTION public.claim_pending_document_job(p_worker_id uuid DEFAULT NULL::uuid)
 RETURNS pending_document_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job public.pending_document_jobs;
BEGIN
  -- Sécurité : staff OU worker serveur (service_role => auth.uid() IS NULL)
  IF auth.uid() IS NOT NULL AND NOT (
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
$function$;

CREATE OR REPLACE FUNCTION public.mark_document_job_generated(p_job_id uuid, p_storage_path text, p_file_size_bytes integer DEFAULT NULL::integer, p_doc_number text DEFAULT NULL::text)
 RETURNS pending_document_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job public.pending_document_jobs;
  v_doc_id UUID;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'employee') OR
    public.has_role(auth.uid(), 'billing_admin') OR
    public.has_role(auth.uid(), 'supervisor')
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_job FROM public.pending_document_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'job not found'; END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.mark_document_job_failed(p_job_id uuid, p_error text)
 RETURNS pending_document_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job public.pending_document_jobs;
  v_backoff_seconds INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'employee') OR
    public.has_role(auth.uid(), 'billing_admin') OR
    public.has_role(auth.uid(), 'supervisor')
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_job FROM public.pending_document_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'job not found'; END IF;

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
$function$;