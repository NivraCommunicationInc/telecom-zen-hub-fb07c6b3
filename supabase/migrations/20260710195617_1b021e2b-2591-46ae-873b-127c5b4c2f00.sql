ALTER TABLE public.consent_records DROP CONSTRAINT IF EXISTS consent_records_recorded_by_role_check;
ALTER TABLE public.consent_records ADD CONSTRAINT consent_records_recorded_by_role_check
  CHECK (recorded_by_role = ANY (ARRAY[
    'subject','core_admin','core_staff','supervisor','support',
    'admin','employee','system','kyc_agent','billing_admin','staff'
  ]));

CREATE OR REPLACE FUNCTION public.qa_purge_consent_records(p_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  ALTER TABLE public.consent_records DISABLE TRIGGER trg_consent_records_guard_iud;
  BEGIN
    DELETE FROM public.consent_records
     WHERE id = ANY(p_ids)
       AND idempotency_key LIKE 'qa-m37-%';
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    ALTER TABLE public.consent_records ENABLE TRIGGER trg_consent_records_guard_iud;
    RAISE;
  END;
  ALTER TABLE public.consent_records ENABLE TRIGGER trg_consent_records_guard_iud;
  RETURN v_deleted;
END;
$$;
REVOKE ALL ON FUNCTION public.qa_purge_consent_records(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qa_purge_consent_records(uuid[]) TO service_role;