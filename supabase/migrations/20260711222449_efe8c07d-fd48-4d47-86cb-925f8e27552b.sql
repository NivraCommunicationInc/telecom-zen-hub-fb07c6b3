CREATE OR REPLACE FUNCTION public.rpc_client_apply_identity_update(
  _client_id uuid,
  _admin_id uuid,
  _patch jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_after profiles%ROWTYPE;
BEGIN
  IF _admin_id IS NULL OR NOT public.has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: admin role required' USING ERRCODE = '42501';
  END IF;

  -- Impersonate admin so BEFORE-UPDATE trigger fn_lock_identity_fields sees an admin actor
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin_id::text)::text, true);

  UPDATE public.profiles p SET
    email         = COALESCE(_patch->>'email', p.email),
    first_name    = COALESCE(_patch->>'first_name', p.first_name),
    last_name     = COALESCE(_patch->>'last_name', p.last_name),
    date_of_birth = COALESCE((_patch->>'date_of_birth')::date, p.date_of_birth),
    phone         = COALESCE(_patch->>'phone', p.phone),
    phone_e164    = COALESCE(_patch->>'phone_e164', p.phone_e164),
    preferred_language = COALESCE(_patch->>'preferred_language', p.preferred_language)
  WHERE p.user_id = _client_id
  RETURNING * INTO v_after;

  IF v_after.user_id IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  RETURN to_jsonb(v_after);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_client_apply_identity_update(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_client_apply_identity_update(uuid, uuid, jsonb) TO service_role;