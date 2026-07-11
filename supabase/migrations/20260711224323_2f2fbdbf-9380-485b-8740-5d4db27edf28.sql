CREATE OR REPLACE FUNCTION public.rpc_client_apply_profile_update(
  _client_id uuid,
  _actor_id uuid,
  _patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_before profiles%ROWTYPE;
  v_after  profiles%ROWTYPE;
  v_fn text;
  v_ln text;
  v_full text;
BEGIN
  IF _actor_id IS NULL OR NOT (
    public.has_role(_actor_id, 'admin')
    OR public.has_role(_actor_id, 'employee')
    OR public.has_role(_actor_id, 'supervisor')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: staff role required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_before FROM public.profiles WHERE user_id = _client_id;
  IF v_before.user_id IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- Impersonate the real staff actor so the BEFORE UPDATE trigger
  -- `fn_lock_identity_fields` resolves auth.uid() to a role that has the
  -- admin/employee bypass. The trigger's business logic is untouched.
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', _actor_id::text)::text,
    true
  );

  v_fn := COALESCE(_patch->>'first_name', v_before.first_name);
  v_ln := COALESCE(_patch->>'last_name',  v_before.last_name);
  v_full := btrim(concat_ws(' ', NULLIF(btrim(v_fn), ''), NULLIF(btrim(v_ln), '')));

  UPDATE public.profiles p SET
    first_name         = COALESCE(_patch->>'first_name', p.first_name),
    last_name          = COALESCE(_patch->>'last_name',  p.last_name),
    date_of_birth      = COALESCE((_patch->>'date_of_birth')::date, p.date_of_birth),
    preferred_language = COALESCE(_patch->>'preferred_language', p.preferred_language),
    full_name          = CASE
                           WHEN (_patch ? 'first_name') OR (_patch ? 'last_name')
                             THEN NULLIF(v_full, '')
                           ELSE p.full_name
                         END
  WHERE p.user_id = _client_id
  RETURNING * INTO v_after;

  RETURN jsonb_build_object(
    'before', jsonb_build_object(
      'first_name', v_before.first_name,
      'last_name',  v_before.last_name,
      'date_of_birth', v_before.date_of_birth,
      'preferred_language', v_before.preferred_language,
      'full_name', v_before.full_name
    ),
    'after', jsonb_build_object(
      'first_name', v_after.first_name,
      'last_name',  v_after.last_name,
      'date_of_birth', v_after.date_of_birth,
      'preferred_language', v_after.preferred_language,
      'full_name', v_after.full_name
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_client_apply_profile_update(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_client_apply_profile_update(uuid, uuid, jsonb) TO service_role;