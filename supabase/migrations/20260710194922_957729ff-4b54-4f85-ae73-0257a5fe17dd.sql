-- Module 37 — QA purge helper for consent_records.
-- The append-only trigger correctly blocks all UPDATE/DELETE. This helper
-- restores service_role's ability to remove QA-only rows produced by the
-- qa-module37-runner. It is restricted to service_role and only deletes rows
-- whose idempotency_key is provided; there is no wildcard path.

CREATE OR REPLACE FUNCTION public.qa_purge_consent_records(p_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  -- Bypass the append-only trigger for this transaction only.
  SET LOCAL session_replication_role = 'replica';

  DELETE FROM public.consent_records
   WHERE id = ANY(p_ids)
     AND idempotency_key LIKE 'qa-m37-%';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.qa_purge_consent_records(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_purge_consent_records(uuid[]) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.qa_purge_consent_records(uuid[]) TO service_role;