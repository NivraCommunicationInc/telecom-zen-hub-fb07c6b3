
DELETE FROM public.qa_module54_e2e_log WHERE scenario LIKE 'M54.2-P6.4v4-%';

DO $harness$
DECLARE
  v_sub_id uuid;
  v_customer_id uuid := 'd97815e8-d35a-4f71-a2c0-0b5e1af5bbd2';
  v_admin_id uuid := '81dad8b0-821b-4897-acc3-fcde86e02d77';
  v_bc_id uuid;
  v_order_id uuid := 'c034232f-9b4c-42d7-a095-59d3a05d9b7e';
  v_oi_id uuid := '4abeb906-12ef-4af6-8359-d8f9b830e0bf';
  v_status_before text; v_status_after text;
  v_audit_id uuid; v_result jsonb; v_susp_id uuid; v_count int;
  v_refc numeric; v_refm int; v_refact boolean; v_refcode text;
BEGIN
  SELECT id INTO v_bc_id FROM public.billing_customers WHERE user_id = v_customer_id LIMIT 1;

  -- Clear any prior v4 fixture rows for this customer to keep the fixture unique
  DELETE FROM public.billing_subscriptions WHERE environment='test' AND source_type='qa_module54_p64';

  v_sub_id := public.rpc_qa_seed_subscription_fixture(jsonb_build_object(
    'customer_id', v_bc_id::text,
    'plan_code','INT-500',
    'plan_name','Internet 500 Mbps',
    'plan_price', 60.00,
    'status','active',
    'service_category','internet',
    'environment','test',
    'source_type','qa_module54_p64',
    'source_id', gen_random_uuid()::text,
    'source_order_item_id', v_oi_id::text,
    'order_id', v_order_id::text,
    'frozen_name','Internet 500 Mbps',
    'frozen_code','INT-500',
    'frozen_unit_price', 60.00,
    'cycle_start_date', (now()::date)::text,
    'cycle_end_date',   ((now() + interval '30 days')::date)::text,
    'frozen_anchor_date', (now()::date)::text
  ));

  INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, status_after, verdict, details)
  VALUES ('M54.2-P6.4v4-T0-seed-active', v_sub_id, 'rpc_qa_seed_subscription_fixture','active','PASS', jsonb_build_object('subscription_id', v_sub_id));

  -- T1 plan change
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin_id::text,'role','authenticated')::text, true);
    SELECT status INTO v_status_before FROM public.billing_subscriptions WHERE id = v_sub_id;
    v_result := public.rpc_admin_change_subscription_plan(v_sub_id,'Internet 1 Gbps',75.00,'INT-1G','P6.4v4 plan change');
    SELECT status INTO v_status_after FROM public.billing_subscriptions WHERE id = v_sub_id;
    SELECT id INTO v_audit_id FROM public.billing_subscription_trace_audit WHERE subscription_id = v_sub_id AND action ILIKE '%plan%' ORDER BY created_at DESC LIMIT 1;
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, status_before, status_after, audit_row_id, verdict, details)
    VALUES ('M54.2-P6.4v4-T1-plan-change', v_sub_id,'rpc_admin_change_subscription_plan',v_status_before,v_status_after,v_audit_id,
      CASE WHEN v_audit_id IS NOT NULL AND COALESCE((v_result->>'ok')::boolean,false) THEN 'PASS' ELSE 'FAIL' END, COALESCE(v_result,'{}'::jsonb));
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, verdict, error) VALUES ('M54.2-P6.4v4-T1-plan-change', v_sub_id,'rpc_admin_change_subscription_plan','FAIL',SQLERRM);
  END;

  -- T2 admin pause
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin_id::text,'role','authenticated')::text, true);
    SELECT status INTO v_status_before FROM public.billing_subscriptions WHERE id = v_sub_id;
    v_result := public.rpc_admin_pause_subscription(v_sub_id,'pause',now()+interval '30 days','P6.4v4 admin pause');
    SELECT status INTO v_status_after FROM public.billing_subscriptions WHERE id = v_sub_id;
    SELECT id INTO v_audit_id FROM public.billing_subscription_trace_audit WHERE subscription_id = v_sub_id AND action ILIKE '%paus%' ORDER BY created_at DESC LIMIT 1;
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, status_before, status_after, audit_row_id, verdict, details)
    VALUES ('M54.2-P6.4v4-T2-admin-pause', v_sub_id,'rpc_admin_pause_subscription',v_status_before,v_status_after,v_audit_id,
      CASE WHEN v_status_after IN ('paused','suspended') THEN 'PASS' ELSE 'FAIL' END, COALESCE(v_result,'{}'::jsonb));
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, verdict, error) VALUES ('M54.2-P6.4v4-T2-admin-pause', v_sub_id,'rpc_admin_pause_subscription','FAIL',SQLERRM);
  END;

  -- T3 admin resume
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin_id::text,'role','authenticated')::text, true);
    SELECT status INTO v_status_before FROM public.billing_subscriptions WHERE id = v_sub_id;
    v_result := public.rpc_admin_pause_subscription(v_sub_id,'resume',NULL,'P6.4v4 admin resume');
    SELECT status INTO v_status_after FROM public.billing_subscriptions WHERE id = v_sub_id;
    SELECT id INTO v_audit_id FROM public.billing_subscription_trace_audit WHERE subscription_id = v_sub_id AND (action ILIKE '%resume%' OR action ILIKE '%reactiv%') ORDER BY created_at DESC LIMIT 1;
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, status_before, status_after, audit_row_id, verdict, details)
    VALUES ('M54.2-P6.4v4-T3-admin-resume', v_sub_id,'rpc_admin_pause_subscription(resume)',v_status_before,v_status_after,v_audit_id,
      CASE WHEN v_status_after = 'active' THEN 'PASS' ELSE 'FAIL' END, COALESCE(v_result,'{}'::jsonb));
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, verdict, error) VALUES ('M54.2-P6.4v4-T3-admin-resume', v_sub_id,'rpc_admin_pause_subscription(resume)','FAIL',SQLERRM);
  END;

  -- T4 client pause
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_customer_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub',v_customer_id::text,'role','authenticated')::text, true);
    SELECT status INTO v_status_before FROM public.billing_subscriptions WHERE id = v_sub_id;
    v_susp_id := public.rpc_client_request_subscription_pause(v_sub_id,'P6.4v4 client pause',14,(now()+interval '3 days')::date,'runtime E2E');
    SELECT status INTO v_status_after FROM public.billing_subscriptions WHERE id = v_sub_id;
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, status_before, status_after, audit_row_id, verdict, details)
    VALUES ('M54.2-P6.4v4-T4-client-pause', v_sub_id,'rpc_client_request_subscription_pause',v_status_before,v_status_after,v_susp_id,
      CASE WHEN v_susp_id IS NOT NULL THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('suspension_request_id', v_susp_id));
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, verdict, error) VALUES ('M54.2-P6.4v4-T4-client-pause', v_sub_id,'rpc_client_request_subscription_pause','FAIL',SQLERRM);
  END;

  -- T5 security suspend
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin_id::text,'role','authenticated')::text, true);
    SELECT status INTO v_status_before FROM public.billing_subscriptions WHERE id = v_sub_id;
    PERFORM public.suspend_subscription(v_sub_id,'P6.4v4 security suspend',NULL,jsonb_build_object('source','qa_e2e_v4'));
    SELECT status INTO v_status_after FROM public.billing_subscriptions WHERE id = v_sub_id;
    SELECT id INTO v_audit_id FROM public.billing_subscription_trace_audit WHERE subscription_id = v_sub_id AND action ILIKE '%suspend%' ORDER BY created_at DESC LIMIT 1;
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, status_before, status_after, audit_row_id, verdict)
    VALUES ('M54.2-P6.4v4-T5-suspend', v_sub_id,'suspend_subscription',v_status_before,v_status_after,v_audit_id,
      CASE WHEN v_status_after = 'suspended' THEN 'PASS' ELSE 'FAIL' END);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, verdict, error) VALUES ('M54.2-P6.4v4-T5-suspend', v_sub_id,'suspend_subscription','FAIL',SQLERRM);
  END;

  -- T6 reactivate
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin_id::text,'role','authenticated')::text, true);
    SELECT status INTO v_status_before FROM public.billing_subscriptions WHERE id = v_sub_id;
    PERFORM public.reactivate_subscription(v_sub_id,jsonb_build_object('source','qa_e2e_v4'));
    SELECT status INTO v_status_after FROM public.billing_subscriptions WHERE id = v_sub_id;
    SELECT id INTO v_audit_id FROM public.billing_subscription_trace_audit WHERE subscription_id = v_sub_id AND action ILIKE '%reactiv%' ORDER BY created_at DESC LIMIT 1;
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, status_before, status_after, audit_row_id, verdict)
    VALUES ('M54.2-P6.4v4-T6-reactivate', v_sub_id,'reactivate_subscription',v_status_before,v_status_after,v_audit_id,
      CASE WHEN v_status_after = 'active' THEN 'PASS' ELSE 'FAIL' END);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, verdict, error) VALUES ('M54.2-P6.4v4-T6-reactivate', v_sub_id,'reactivate_subscription','FAIL',SQLERRM);
  END;

  -- T7 referral attach
  BEGIN
    v_count := public.rpc_apply_referral_discount(v_bc_id, v_order_id, 'QA-P64V4-REF', 5.00, 3);
    SELECT referral_discount_amount, referral_discount_months_remaining, referral_discount_active, referral_code_used
      INTO v_refc, v_refm, v_refact, v_refcode
      FROM public.billing_subscriptions WHERE id = v_sub_id;
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, verdict, details)
    VALUES ('M54.2-P6.4v4-T7-referral-attach', v_sub_id,'rpc_apply_referral_discount',
      CASE WHEN v_count >= 1 AND v_refact = true THEN 'PASS' ELSE 'FAIL' END,
      jsonb_build_object('rows_updated', v_count, 'discount', v_refc, 'months', v_refm, 'active', v_refact, 'code', v_refcode));
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, verdict, error) VALUES ('M54.2-P6.4v4-T7-referral-attach', v_sub_id,'rpc_apply_referral_discount','FAIL',SQLERRM);
  END;

  -- T8 not_renewed
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin_id::text,'role','authenticated')::text, true);
    SELECT status INTO v_status_before FROM public.billing_subscriptions WHERE id = v_sub_id;
    PERFORM public.rpc_mark_subscription_not_renewed(v_sub_id,'P6.4v4 not_renewed');
    SELECT status INTO v_status_after FROM public.billing_subscriptions WHERE id = v_sub_id;
    SELECT id INTO v_audit_id FROM public.billing_subscription_trace_audit WHERE subscription_id = v_sub_id AND action ILIKE '%not_renew%' ORDER BY created_at DESC LIMIT 1;
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, status_before, status_after, audit_row_id, verdict)
    VALUES ('M54.2-P6.4v4-T8-not-renewed', v_sub_id,'rpc_mark_subscription_not_renewed',v_status_before,v_status_after,v_audit_id,
      CASE WHEN v_status_after = 'not_renewed' THEN 'PASS' ELSE 'FAIL' END);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, verdict, error) VALUES ('M54.2-P6.4v4-T8-not-renewed', v_sub_id,'rpc_mark_subscription_not_renewed','FAIL',SQLERRM);
  END;

  -- T9 cancel
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin_id::text,'role','authenticated')::text, true);
    SELECT status INTO v_status_before FROM public.billing_subscriptions WHERE id = v_sub_id;
    PERFORM public.cancel_subscription(v_sub_id,'P6.4v4 cancel',jsonb_build_object('source','qa_e2e_v4'));
    SELECT status INTO v_status_after FROM public.billing_subscriptions WHERE id = v_sub_id;
    SELECT id INTO v_audit_id FROM public.billing_subscription_trace_audit WHERE subscription_id = v_sub_id AND action ILIKE '%cancel%' ORDER BY created_at DESC LIMIT 1;
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, status_before, status_after, audit_row_id, verdict)
    VALUES ('M54.2-P6.4v4-T9-cancel', v_sub_id,'cancel_subscription',v_status_before,v_status_after,v_audit_id,
      CASE WHEN v_status_after IN ('cancelled','canceled') THEN 'PASS' ELSE 'FAIL' END);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, verdict, error) VALUES ('M54.2-P6.4v4-T9-cancel', v_sub_id,'cancel_subscription','FAIL',SQLERRM);
  END;
END $harness$;
