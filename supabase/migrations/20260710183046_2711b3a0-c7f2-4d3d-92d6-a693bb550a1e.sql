
DO $$
DECLARE
  r1 record;
  r2 record;
  cnt int;
BEGIN
  -- Grant temporarily so we can run inside DO block context (superuser DO runs as postgres)
  -- Direct call to RPC (postgres role has EXECUTE by default via SECURITY DEFINER owner)
  SELECT id, ticket_number, idempotent INTO r1
  FROM public.rpc_create_supervisor_escalation(
    '604f320c-43b7-4720-9ddf-40ee7620990d'::uuid,
    'e2aec6ad-0bb8-4455-8106-75f3138a0ebf'::uuid,
    NULL,
    'qa-phaseB-seed-001',
    'billing',
    '[ESCALATION] QA Phase B seed',
    'RPC seed check for Phase B closure.',
    '81dad8b0-821b-4897-acc3-fcde86e02d77'::uuid,
    'QA Runner',
    'admin',
    'qa@nivra-telecom.ca'
  );
  RAISE NOTICE 'INSERT1: id=% ticket_number=% idempotent=%', r1.id, r1.ticket_number, r1.idempotent;

  -- Second call with same idempotency_key must return the same row (idempotent=true)
  SELECT id, ticket_number, idempotent INTO r2
  FROM public.rpc_create_supervisor_escalation(
    '604f320c-43b7-4720-9ddf-40ee7620990d'::uuid,
    'e2aec6ad-0bb8-4455-8106-75f3138a0ebf'::uuid,
    NULL,
    'qa-phaseB-seed-001',
    'billing',
    '[ESCALATION] duplicate',
    'should not create a second row',
    '81dad8b0-821b-4897-acc3-fcde86e02d77'::uuid,
    'QA Runner',
    'admin',
    'qa@nivra-telecom.ca'
  );
  RAISE NOTICE 'INSERT2 (idempotent expected): id=% ticket_number=% idempotent=%', r2.id, r2.ticket_number, r2.idempotent;

  IF r1.id <> r2.id THEN
    RAISE EXCEPTION 'IDEMPOTENCY FAIL: distinct ids returned';
  END IF;

  SELECT count(*) INTO cnt
  FROM public.internal_tickets
  WHERE idempotency_key = 'qa-phaseB-seed-001';
  RAISE NOTICE 'ROW COUNT for idempotency_key=qa-phaseB-seed-001 (expect 1): %', cnt;
  IF cnt <> 1 THEN
    RAISE EXCEPTION 'IDEMPOTENCY FAIL: % rows exist', cnt;
  END IF;

  -- Verify server-controlled fields
  PERFORM 1 FROM public.internal_tickets
  WHERE id = r1.id
    AND category = 'escalation'
    AND assigned_to_department = 'supervisor'
    AND priority = 'urgent'
    AND status = 'open'
    AND escalation_type = 'billing'
    AND ticket_number IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIELD CONTROL FAIL for id=%', r1.id;
  END IF;

  -- Test SINGLE-DOOR trigger blocks a direct insert bypassing the flag
  BEGIN
    INSERT INTO public.internal_tickets (
      account_id, client_user_id, subject, description,
      category, assigned_to_department, priority, status,
      created_by_id, created_by_name, created_by_role, created_by_email,
      idempotency_key, escalation_type
    ) VALUES (
      '604f320c-43b7-4720-9ddf-40ee7620990d'::uuid,
      'e2aec6ad-0bb8-4455-8106-75f3138a0ebf'::uuid,
      '[ESCALATION] direct bypass attempt',
      'should be blocked',
      'escalation', 'supervisor', 'urgent', 'open',
      '81dad8b0-821b-4897-acc3-fcde86e02d77'::uuid,
      'attacker', 'admin', 'x@x.com',
      'qa-phaseB-direct-002', 'billing'
    );
    RAISE EXCEPTION 'SINGLE-DOOR FAIL: direct insert succeeded';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'SINGLE-DOOR OK: direct insert blocked (%: %)', SQLSTATE, SQLERRM;
  END;

  -- Cleanup seed row
  DELETE FROM public.internal_tickets WHERE id = r1.id;
  RAISE NOTICE 'CLEANUP OK: seed row deleted';
END
$$;
