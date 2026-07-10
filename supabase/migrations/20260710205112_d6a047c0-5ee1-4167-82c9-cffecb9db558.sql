-- QA helper for Module 38: allow controlled purge of privacy_requests rows.
-- Uses SECURITY DEFINER + session-scoped bypass on the guard trigger.
CREATE OR REPLACE FUNCTION public.qa_purge_privacy_requests(p_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;
  ALTER TABLE public.privacy_requests DISABLE TRIGGER trg_privacy_requests_guard_iud;
  ALTER TABLE public.privacy_requests DISABLE TRIGGER trg_privacy_requests_state_machine;
  DELETE FROM public.privacy_requests WHERE id = ANY(p_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  ALTER TABLE public.privacy_requests ENABLE TRIGGER trg_privacy_requests_guard_iud;
  ALTER TABLE public.privacy_requests ENABLE TRIGGER trg_privacy_requests_state_machine;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.qa_purge_privacy_requests(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qa_purge_privacy_requests(uuid[]) TO service_role;