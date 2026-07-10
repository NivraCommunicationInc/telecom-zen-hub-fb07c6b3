CREATE OR REPLACE FUNCTION public.qa_purge_consent_records(p_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  ALTER TABLE public.consent_records DISABLE TRIGGER trg_consent_records_guard_write;
  BEGIN
    DELETE FROM public.consent_records
     WHERE id = ANY(p_ids)
       AND idempotency_key LIKE 'qa-m37-%';
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    ALTER TABLE public.consent_records ENABLE TRIGGER trg_consent_records_guard_write;
    RAISE;
  END;
  ALTER TABLE public.consent_records ENABLE TRIGGER trg_consent_records_guard_write;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.qa_purge_consent_records(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_purge_consent_records(uuid[]) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.qa_purge_consent_records(uuid[]) TO service_role;