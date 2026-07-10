
CREATE OR REPLACE FUNCTION public.guard_compensation_writes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.metadata ? 'compensation') THEN
    -- session_user = the postgres role of the connection (service_role, authenticated, anon)
    -- current_user is masked to function owner inside SECURITY DEFINER
    IF session_user <> 'service_role' AND coalesce(auth.role(),'') <> 'service_role' THEN
      RAISE EXCEPTION 'compensation_direct_write_forbidden: use core-issue-compensation edge function';
    END IF;
    IF NEW.idempotency_key IS NULL THEN RAISE EXCEPTION 'compensation_idempotency_key_required'; END IF;
    IF NEW.expires_at IS NULL THEN RAISE EXCEPTION 'compensation_expires_at_required'; END IF;
    IF (NEW.metadata->'compensation'->>'category') IS NULL THEN RAISE EXCEPTION 'compensation_category_required'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
