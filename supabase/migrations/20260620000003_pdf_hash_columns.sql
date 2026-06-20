-- Phase 1 PDF integrity: add pdf_hash (SHA-256) to document tables.
-- Callers compute the hash at generation time and store it here.
-- A stored hash proves that the PDF file at storage_path has not been
-- modified after generation (compare file hash vs stored hash).

ALTER TABLE client_auto_documents
  ADD COLUMN IF NOT EXISTS pdf_hash text;

ALTER TABLE order_documents
  ADD COLUMN IF NOT EXISTS pdf_hash text;

-- Extend mark_document_job_generated to accept and store the PDF hash.
CREATE OR REPLACE FUNCTION public.mark_document_job_generated(
  p_job_id uuid,
  p_storage_path text,
  p_file_size_bytes integer DEFAULT NULL::integer,
  p_doc_number text DEFAULT NULL::text,
  p_pdf_hash text DEFAULT NULL::text
)
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
    recipient_email, metadata, pdf_hash
  ) VALUES (
    v_job.account_id, v_job.client_id, v_job.doc_type, p_doc_number, v_job.event_type,
    v_job.idempotency_key, p_storage_path, p_file_size_bytes,
    v_job.recipient_email, v_job.event_payload, p_pdf_hash
  )
  ON CONFLICT (idempotency_key) DO UPDATE
    SET storage_path = EXCLUDED.storage_path,
        pdf_hash = EXCLUDED.pdf_hash
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
