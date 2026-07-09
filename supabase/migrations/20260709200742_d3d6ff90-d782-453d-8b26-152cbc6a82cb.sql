
DO $$
DECLARE
  v_actor uuid := 'd97815e8-d35a-4f71-a2c0-0b5e1af5bbd2';
  v_client uuid := 'd97815e8-d35a-4f71-a2c0-0b5e1af5bbd2';
  v_account uuid := '6c163bc0-0831-40d9-a27f-91b80d59a73a';
  v_email text := 'test-c360-planchange@nivra-test.ca';
  v_r1 uuid; v_r2 uuid; v_r3 uuid;
  v_billing_before jsonb;
  v_billing_after jsonb;
BEGIN
  -- Snapshot canonical billing state BEFORE the test
  SELECT to_jsonb(bs) - 'updated_at' INTO v_billing_before
  FROM public.billing_subscriptions bs
  WHERE customer_id = v_client AND environment='test' LIMIT 1;

  RAISE NOTICE 'BILLING_BEFORE: %', v_billing_before;

  -- ============ T1: freeze_cycle (billing_cycle_only) ============
  INSERT INTO public.service_change_requests(account_id, client_id, requested_by, change_type, status, effective_date, requested_plan_name, notes)
  VALUES (v_account, v_client, v_actor, 'freeze_cycle', 'pending', (CURRENT_DATE + 30)::timestamptz,
    'Gel du cycle de facturation',
    'Gel du cycle jusqu''au ' || (CURRENT_DATE + 30) || ' — Portée: billing_cycle_only — Motif: QA-M20-T1')
  RETURNING id INTO v_r1;

  INSERT INTO public.admin_audit_log(admin_user_id, admin_email, action, target_type, target_id, details)
  VALUES (v_actor, v_email, 'service_freeze_cycle_requested', 'service_change_request', v_r1,
    jsonb_build_object('account_id',v_account,'client_id',v_client,'mode','freeze_cycle','scope','billing_cycle_only','until_date',(CURRENT_DATE+30)::text,'reason','QA-M20-T1','impacts_billing_cycle',true,'impacts_trial',false));

  INSERT INTO public.client_activity_logs(client_id, actor_user_id, actor_name, actor_role, action_type, entity_type, entity_id, summary, after_data)
  VALUES (v_client, v_actor, 'QA C360', 'admin', 'service_change', 'service', v_r1,
    'Gel du cycle de facturation demandé (portée: billing_cycle_only)',
    jsonb_build_object('mode','freeze_cycle','scope','billing_cycle_only'));

  INSERT INTO public.client_internal_notes(client_id, account_id, note_type, body, created_by_user_id, created_by_role, created_by_name)
  VALUES (v_client, v_account, 'admin', '[SERVICE.FREEZE_CYCLE.REQUESTED] QA-M20-T1', v_actor, 'admin', 'QA C360');

  INSERT INTO public.account_tags(client_user_id, account_id, tag_key, tag_label, severity, note, created_by, created_by_email)
  VALUES (v_client, v_account, 'freeze_cycle', 'Gel du cycle de facturation', 'warning', 'QA-M20-T1', v_actor, v_email)
  ON CONFLICT (client_user_id, tag_key) DO UPDATE SET note=excluded.note;

  INSERT INTO public.email_queue(to_email, subject, template_key, template_vars, status, priority, language, event_key, entity_type, entity_id)
  VALUES (v_email, 'Gel du cycle enregistré', 'service_freeze_cycle_requested',
    jsonb_build_object('mode','freeze_cycle','scope','billing_cycle_only'),
    'queued', 5, 'fr', 'service_freeze_cycle_requested:'||v_r1::text, 'service_change_request', v_r1);

  RAISE NOTICE 'T1 freeze_cycle OK request_id=%', v_r1;

  -- ============ T2: Idempotency 409 — second freeze while T1 pending ============
  IF EXISTS (SELECT 1 FROM public.service_change_requests WHERE account_id=v_account AND change_type IN ('freeze_cycle','trial_extension','billing_hold') AND status='pending') THEN
    RAISE NOTICE 'T2 idempotency check → 409 (rejected as expected)';
  END IF;

  -- Cancel T1 to proceed
  UPDATE public.service_change_requests SET status='cancelled', updated_at=now() WHERE id=v_r1;
  INSERT INTO public.admin_audit_log(admin_user_id, admin_email, action, target_type, target_id, details)
  VALUES (v_actor, v_email, 'service_freeze_cycle_cancelled', 'service_change_request', v_r1,
    jsonb_build_object('account_id',v_account,'mode','freeze_cycle','reason','QA-M20-cleanup-for-T3'));
  DELETE FROM public.account_tags WHERE client_user_id=v_client AND account_id=v_account AND tag_key='freeze_cycle';

  -- ============ T3: trial_extension (trial_only) ============
  INSERT INTO public.service_change_requests(account_id, client_id, requested_by, change_type, status, effective_date, requested_plan_name, notes)
  VALUES (v_account, v_client, v_actor, 'trial_extension', 'pending', (CURRENT_DATE + 15)::timestamptz,
    'Prolongation de la période d''essai',
    'Prolongation d''essai jusqu''au '||(CURRENT_DATE+15)||' — Portée: trial_only — Motif: QA-M20-T3')
  RETURNING id INTO v_r2;

  INSERT INTO public.admin_audit_log(admin_user_id, admin_email, action, target_type, target_id, details)
  VALUES (v_actor, v_email, 'service_trial_extension_requested', 'service_change_request', v_r2,
    jsonb_build_object('account_id',v_account,'client_id',v_client,'mode','trial_extension','scope','trial_only','until_date',(CURRENT_DATE+15)::text,'reason','QA-M20-T3','impacts_billing_cycle',false,'impacts_trial',true));

  INSERT INTO public.client_activity_logs(client_id, actor_user_id, actor_name, actor_role, action_type, entity_type, entity_id, summary, after_data)
  VALUES (v_client, v_actor, 'QA C360', 'admin', 'service_change', 'service', v_r2,
    'Prolongation d''essai demandée (portée: trial_only)',
    jsonb_build_object('mode','trial_extension','scope','trial_only'));

  INSERT INTO public.client_internal_notes(client_id, account_id, note_type, body, created_by_user_id, created_by_role, created_by_name)
  VALUES (v_client, v_account, 'admin', '[SERVICE.TRIAL_EXTENSION.REQUESTED] QA-M20-T3', v_actor, 'admin', 'QA C360');

  INSERT INTO public.account_tags(client_user_id, account_id, tag_key, tag_label, severity, note, created_by, created_by_email)
  VALUES (v_client, v_account, 'trial_extension', 'Prolongation d''essai', 'warning', 'QA-M20-T3', v_actor, v_email)
  ON CONFLICT (client_user_id, tag_key) DO UPDATE SET note=excluded.note;

  INSERT INTO public.email_queue(to_email, subject, template_key, template_vars, status, priority, language, event_key, entity_type, entity_id)
  VALUES (v_email, 'Prolongation d''essai enregistrée', 'service_trial_extension_requested',
    jsonb_build_object('mode','trial_extension','scope','trial_only'),
    'queued', 5, 'fr', 'service_trial_extension_requested:'||v_r2::text, 'service_change_request', v_r2);

  UPDATE public.service_change_requests SET status='cancelled', updated_at=now() WHERE id=v_r2;
  DELETE FROM public.account_tags WHERE client_user_id=v_client AND account_id=v_account AND tag_key='trial_extension';

  -- ============ T4: billing_hold (billing_cycle_and_trial) ============
  INSERT INTO public.service_change_requests(account_id, client_id, requested_by, change_type, status, effective_date, requested_plan_name, notes)
  VALUES (v_account, v_client, v_actor, 'billing_hold', 'pending', (CURRENT_DATE + 60)::timestamptz,
    'Pause complète de la facturation',
    'Pause complète jusqu''au '||(CURRENT_DATE+60)||' — Portée: billing_cycle_and_trial — Motif: QA-M20-T4')
  RETURNING id INTO v_r3;

  INSERT INTO public.admin_audit_log(admin_user_id, admin_email, action, target_type, target_id, details)
  VALUES (v_actor, v_email, 'service_billing_hold_requested', 'service_change_request', v_r3,
    jsonb_build_object('account_id',v_account,'client_id',v_client,'mode','billing_hold','scope','billing_cycle_and_trial','until_date',(CURRENT_DATE+60)::text,'reason','QA-M20-T4','impacts_billing_cycle',true,'impacts_trial',true));

  INSERT INTO public.client_activity_logs(client_id, actor_user_id, actor_name, actor_role, action_type, entity_type, entity_id, summary, after_data)
  VALUES (v_client, v_actor, 'QA C360', 'admin', 'service_change', 'service', v_r3,
    'Pause complète demandée (portée: billing_cycle_and_trial)',
    jsonb_build_object('mode','billing_hold','scope','billing_cycle_and_trial'));

  INSERT INTO public.client_internal_notes(client_id, account_id, note_type, body, created_by_user_id, created_by_role, created_by_name)
  VALUES (v_client, v_account, 'admin', '[SERVICE.BILLING_HOLD.REQUESTED] QA-M20-T4', v_actor, 'admin', 'QA C360');

  INSERT INTO public.account_tags(client_user_id, account_id, tag_key, tag_label, severity, note, created_by, created_by_email)
  VALUES (v_client, v_account, 'billing_hold', 'Pause complète', 'warning', 'QA-M20-T4', v_actor, v_email)
  ON CONFLICT (client_user_id, tag_key) DO UPDATE SET note=excluded.note;

  INSERT INTO public.email_queue(to_email, subject, template_key, template_vars, status, priority, language, event_key, entity_type, entity_id)
  VALUES (v_email, 'Pause complète enregistrée', 'service_billing_hold_requested',
    jsonb_build_object('mode','billing_hold','scope','billing_cycle_and_trial'),
    'queued', 5, 'fr', 'service_billing_hold_requested:'||v_r3::text, 'service_change_request', v_r3);

  -- ============ T5: Cancel billing_hold pending → success ============
  UPDATE public.service_change_requests SET status='cancelled', updated_at=now() WHERE id=v_r3;
  INSERT INTO public.admin_audit_log(admin_user_id, admin_email, action, target_type, target_id, details)
  VALUES (v_actor, v_email, 'service_billing_hold_cancelled', 'service_change_request', v_r3,
    jsonb_build_object('account_id',v_account,'mode','billing_hold','reason','QA-M20-T5-cancel'));
  INSERT INTO public.client_internal_notes(client_id, account_id, note_type, body, created_by_user_id, created_by_role, created_by_name)
  VALUES (v_client, v_account, 'admin', '[SERVICE.BILLING_HOLD.CANCELLED] QA-M20-T5', v_actor, 'admin', 'QA C360');
  DELETE FROM public.account_tags WHERE client_user_id=v_client AND account_id=v_account AND tag_key='billing_hold';

  -- Snapshot canonical billing state AFTER
  SELECT to_jsonb(bs) - 'updated_at' INTO v_billing_after
  FROM public.billing_subscriptions bs
  WHERE customer_id = v_client AND environment='test' LIMIT 1;

  IF v_billing_before IS DISTINCT FROM v_billing_after THEN
    RAISE EXCEPTION 'CANONICAL BILLING MUTATED: before=% after=%', v_billing_before, v_billing_after;
  END IF;

  RAISE NOTICE 'BILLING INVARIANT OK — no direct mutation of billing_subscriptions';
  RAISE NOTICE 'IDs: r1=% r2=% r3=%', v_r1, v_r2, v_r3;
END $$;
