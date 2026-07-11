
CREATE OR REPLACE FUNCTION public.rpc_account_journal_write(
  p_target_table TEXT,
  p_payload JSONB,
  p_event_key TEXT DEFAULT NULL,
  p_correlation_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID := auth.uid();
  v_actor_role TEXT;
  v_actor_name TEXT;
  v_actor_email TEXT;
  v_event_key TEXT := p_event_key;
  v_correlation_id UUID := COALESCE(p_correlation_id, gen_random_uuid());
  v_new_id UUID;
  v_existing JSONB;
  v_payload JSONB := COALESCE(p_payload, '{}'::jsonb);
  v_client_id UUID;
  v_account_id UUID;
  v_order_id UUID;
  v_jwt_role TEXT;
  v_actor_override JSONB;
BEGIN
  PERFORM set_config('app.journal_gateway','on', true);

  -- Detect JWT role (Supabase PostgREST). NULL / '' outside a request context.
  BEGIN
    v_jwt_role := COALESCE((current_setting('request.jwt.claims', true))::jsonb->>'role', '');
  EXCEPTION WHEN OTHERS THEN
    v_jwt_role := '';
  END;

  -- Actor resolution
  IF v_actor_user_id IS NULL THEN
    v_actor_override := v_payload->'_actor';
    IF v_jwt_role = 'service_role' AND v_actor_override IS NOT NULL THEN
      v_actor_user_id := NULLIF(v_actor_override->>'user_id','')::uuid;
      v_actor_role   := COALESCE(NULLIF(v_actor_override->>'role',''), 'system');
      v_actor_name   := COALESCE(NULLIF(v_actor_override->>'name',''), 'system');
      v_actor_email  := NULLIF(v_actor_override->>'email','');
    END IF;
  END IF;

  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'JOURNAL-401: authentication required' USING ERRCODE = '42501';
  END IF;

  -- Idempotency short-circuit
  IF v_event_key IS NOT NULL THEN
    SELECT result INTO v_existing
      FROM public.account_journal_idempotency
      WHERE event_key = v_event_key
      LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'idempotent', true, 'result', v_existing);
    END IF;
  END IF;

  -- If actor came from auth.uid(), resolve name/role/email from profiles + user_roles
  IF v_actor_role IS NULL OR v_actor_name IS NULL THEN
    SELECT
      COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.email, 'system'),
      p.email
      INTO v_actor_name, v_actor_email
      FROM public.profiles p WHERE p.id = v_actor_user_id;

    SELECT ur.role::text INTO v_actor_role
      FROM public.user_roles ur
      WHERE ur.user_id = v_actor_user_id
      ORDER BY CASE ur.role::text
        WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 ELSE 9 END
      LIMIT 1;
    v_actor_role := COALESCE(v_actor_role, 'authenticated');
  END IF;

  -- Extract common identifiers
  v_client_id  := NULLIF(v_payload->>'client_id','')::uuid;
  v_account_id := NULLIF(v_payload->>'account_id','')::uuid;
  v_order_id   := NULLIF(v_payload->>'order_id','')::uuid;

  -- Strip _actor from payload for downstream dispatch (never written to columns)
  v_payload := v_payload - '_actor';

  IF p_target_table NOT IN (
    'client_activity_logs','activity_logs','client_internal_notes',
    'account_followups','order_status_history','order_internal_notes'
  ) THEN
    RAISE EXCEPTION 'JOURNAL-400: target_table % not allowed', p_target_table USING ERRCODE = '22023';
  END IF;

  IF p_target_table = 'client_activity_logs' THEN
    INSERT INTO public.client_activity_logs(
      client_id, actor_user_id, actor_name, actor_role,
      action_type, entity_type, entity_id, summary,
      before_data, after_data, correlation_id, event_key, metadata
    ) VALUES (
      v_client_id, v_actor_user_id, v_actor_name, v_actor_role,
      COALESCE(v_payload->>'action_type','note'),
      v_payload->>'entity_type',
      NULLIF(v_payload->>'entity_id','')::uuid,
      v_payload->>'summary',
      v_payload->'before_data', v_payload->'after_data',
      v_correlation_id, v_event_key, COALESCE(v_payload->'metadata','{}'::jsonb)
    ) RETURNING id INTO v_new_id;

  ELSIF p_target_table = 'activity_logs' THEN
    INSERT INTO public.activity_logs(
      user_id, action, entity_type, entity_id, details,
      actor_role, actor_name, actor_email,
      changed_field, reason, old_value, new_value,
      correlation_id, event_key, metadata
    ) VALUES (
      v_actor_user_id,
      COALESCE(v_payload->>'action','write'),
      v_payload->>'entity_type',
      NULLIF(v_payload->>'entity_id','')::uuid,
      COALESCE(v_payload->'details','{}'::jsonb),
      v_actor_role, v_actor_name, v_actor_email,
      v_payload->>'changed_field', v_payload->>'reason',
      v_payload->>'old_value', v_payload->>'new_value',
      v_correlation_id, v_event_key, COALESCE(v_payload->'metadata','{}'::jsonb)
    ) RETURNING id INTO v_new_id;

  ELSIF p_target_table = 'client_internal_notes' THEN
    INSERT INTO public.client_internal_notes(
      client_id, account_id, note_type, body,
      created_by_user_id, created_by_role, created_by_name,
      correlation_id, event_key, metadata
    ) VALUES (
      v_client_id, v_account_id,
      COALESCE(v_payload->>'note_type','general'),
      v_payload->>'body',
      v_actor_user_id, v_actor_role, v_actor_name,
      v_correlation_id, v_event_key, COALESCE(v_payload->'metadata','{}'::jsonb)
    ) RETURNING id INTO v_new_id;

  ELSIF p_target_table = 'account_followups' THEN
    INSERT INTO public.account_followups(
      client_user_id, account_id, title, description,
      category, priority, status, due_at,
      assigned_to, assigned_to_email, created_by, created_by_email,
      correlation_id, event_key, metadata
    ) VALUES (
      v_client_id, v_account_id,
      v_payload->>'title', v_payload->>'description',
      COALESCE(v_payload->>'category','general'),
      COALESCE(v_payload->>'priority','normal'),
      COALESCE(v_payload->>'status','open'),
      NULLIF(v_payload->>'due_at','')::timestamptz,
      NULLIF(v_payload->>'assigned_to','')::uuid,
      v_payload->>'assigned_to_email',
      v_actor_user_id, v_actor_email,
      v_correlation_id, v_event_key, COALESCE(v_payload->'metadata','{}'::jsonb)
    ) RETURNING id INTO v_new_id;

  ELSIF p_target_table = 'order_status_history' THEN
    INSERT INTO public.order_status_history(
      order_id, status_domain, old_status, new_status,
      actor_user_id, actor_role, actor_name, change_reason, metadata,
      correlation_id, event_key
    ) VALUES (
      v_order_id, v_payload->>'status_domain',
      v_payload->>'old_status', v_payload->>'new_status',
      v_actor_user_id, v_actor_role, v_actor_name,
      v_payload->>'change_reason',
      COALESCE(v_payload->'metadata','{}'::jsonb),
      v_correlation_id, v_event_key
    ) RETURNING id INTO v_new_id;

  ELSIF p_target_table = 'order_internal_notes' THEN
    INSERT INTO public.order_internal_notes(
      order_id, body,
      created_by_user_id, created_by_role, created_by_name,
      correlation_id, event_key, metadata
    ) VALUES (
      v_order_id, v_payload->>'body',
      v_actor_user_id, v_actor_role, v_actor_name,
      v_correlation_id, v_event_key, COALESCE(v_payload->'metadata','{}'::jsonb)
    ) RETURNING id INTO v_new_id;
  END IF;

  IF v_event_key IS NOT NULL THEN
    INSERT INTO public.account_journal_idempotency(
      event_key, target_table, target_id, correlation_id, actor_user_id, result
    ) VALUES (
      v_event_key, p_target_table, v_new_id, v_correlation_id, v_actor_user_id,
      jsonb_build_object('id', v_new_id)
    ) ON CONFLICT (event_key) DO NOTHING;
  END IF;

  INSERT INTO public.account_journal_audit_log(
    correlation_id, event_key, target_table, target_id, operation,
    via_gateway, enforcement_mode,
    actor_user_id, actor_role, actor_name,
    client_id, account_id, order_id, payload
  ) VALUES (
    v_correlation_id, v_event_key, p_target_table, v_new_id, 'WRITE',
    true, 'audit',
    v_actor_user_id, v_actor_role, v_actor_name,
    v_client_id, v_account_id, v_order_id, v_payload
  );

  RETURN jsonb_build_object(
    'ok', true, 'id', v_new_id,
    'correlation_id', v_correlation_id,
    'event_key', v_event_key
  );
END;
$$;
