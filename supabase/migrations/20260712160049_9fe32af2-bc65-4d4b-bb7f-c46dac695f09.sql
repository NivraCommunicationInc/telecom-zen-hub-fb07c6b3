
DELETE FROM public.qa_module54_e2e_log WHERE scenario LIKE 'M54.2-P6.4-%';

DO $harness$
DECLARE
  v_sub_id uuid := 'fd8767a4-2415-458b-9835-22384505eedf';
  v_customer_id uuid := 'd97815e8-d35a-4f71-a2c0-0b5e1af5bbd2';
  v_admin_id uuid := '81dad8b0-821b-4897-acc3-fcde86e02d77';
  v_order_id uuid := 'c034232f-9b4c-42d7-a095-59d3a05d9b7e';
  v_status_before text;
  v_status_after text;
  v_audit_id uuid;
  v_result jsonb;
  v_susp_id uuid;
  v_bc_id uuid;
  v_inv_id uuid;
  v_count int;
  v_refc numeric; v_refm int; v_refact boolean; v_refcode text;
BEGIN
  SELECT id INTO v_bc_id FROM public.billing_customers WHERE user_id = v_customer_id LIMIT 1;

  -- Baseline reset: bring fixture out of terminal state via allowlisted state machine
  BEGIN
    PERFORM public.reactivate_subscription(v_sub_id, jsonb_build_object('source','qa_e2e_reset'));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  ---------- T0 — Activate via paid invoice trigger ----------
  BEGIN
    SELECT status INTO v_status_before FROM public.billing_subscriptions WHERE id = v_sub_id;
    INSERT INTO public.billing_invoices (
      customer_id, subscription_id, invoice_number, status,
      subtotal, tps_amount, tvq_amount, total, balance_due, currency,
      due_date, environment, order_id, type, paid_at
    ) VALUES (
      v_bc_id, v_sub_id,
      'INV-QA-P64-' || substr(gen_random_uuid()::text,1,8),
      'paid', 43.49, 2.17, 4.34, 50.00, 0.00, 'CAD',
      now()::date, 'test', v_order_id, 'renewal'::billing_invoice_type, now()
    ) RETURNING id INTO v_inv_id;
    SELECT status INTO v_status_after FROM public.billing_subscriptions WHERE id = v_sub_id;
    SELECT id INTO v_audit_id FROM public.billing_subscription_trace_audit
      WHERE subscription_id = v_sub_id ORDER BY created_at DESC LIMIT 1;
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, status_before, status_after, audit_row_id, verdict, details)
    VALUES ('M54.2-P6.4-T0-activation', v_sub_id, 'fn_ensure_subscription_on_invoice_paid (trigger)',
      v_status_before, v_status_after, v_audit_id,
      CASE WHEN v_status_after = 'active' THEN 'PASS' ELSE 'FAIL' END,
      jsonb_build_object('invoice_id', v_inv_id));
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, verdict, error)
    VALUES ('M54.2-P6.4-T0-activation', v_sub_id, 'invoice_paid_trigger', 'FAIL', SQLERRM);
  END;

  ---------- T1 — Admin plan change ----------
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin_id::text,'role','authenticated')::text, true);
    SELECT status INTO v_status_before FROM public.billing_subscriptions WHERE id = v_sub_id;
    v_result := public.rpc_admin_change_subscription_plan(v_sub_id,'Internet 1 Gbps',75.00,'INT-1G','M54.2-P6.4 QA plan upgrade');
    SELECT status INTO v_status_after FROM public.billing_subscriptions WHERE id = v_sub_id;
    SELECT id INTO v_audit_id FROM public.billing_subscription_trace_audit
      WHERE subscription_id = v_sub_id AND action ILIKE '%plan%' ORDER BY created_at DESC LIMIT 1;
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, status_before, status_after, audit_row_id, verdict, details)
    VALUES ('M54.2-P6.4-T1-plan-change', v_sub_id, 'rpc_admin_change_subscription_plan',
      v_status_before, v_status_after, v_audit_id,
      CASE WHEN v_audit_id IS NOT NULL AND COALESCE((v_result->>'ok')::boolean,false) THEN 'PASS' ELSE 'FAIL' END,
      COALESCE(v_result,'{}'::jsonb));
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, verdict, error)
    VALUES ('M54.2-P6.4-T1-plan-change', v_sub_id, 'rpc_admin_change_subscription_plan', 'FAIL', SQLERRM);
  END;

  ---------- T2 — Admin pause ----------
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin_id::text,'role','authenticated')::text, true);
    SELECT status INTO v_status_before FROM public.billing_subscriptions WHERE id = v_sub_id;
    v_result := public.rpc_admin_pause_subscription(v_sub_id,'pause',now()+interval '30 days','M54.2-P6.4 QA admin pause');
    SELECT status INTO v_status_after FROM public.billing_subscriptions WHERE id = v_sub_id;
    SELECT id INTO v_audit_id FROM public.billing_subscription_trace_audit
      WHERE subscription_id = v_sub_id AND action ILIKE '%paus%' ORDER BY created_at DESC LIMIT 1;
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, status_before, status_after, audit_row_id, verdict, details)
    VALUES ('M54.2-P6.4-T2-admin-pause', v_sub_id, 'rpc_admin_pause_subscription',
      v_status_before, v_status_after, v_audit_id,
      CASE WHEN v_status_after IN ('paused','suspended') THEN 'PASS' ELSE 'FAIL' END,
      COALESCE(v_result,'{}'::jsonb));
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, verdict, error)
    VALUES ('M54.2-P6.4-T2-admin-pause', v_sub_id, 'rpc_admin_pause_subscription', 'FAIL', SQLERRM);
  END;

  ---------- T3 — Admin resume ----------
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin_id::text,'role','authenticated')::text, true);
    SELECT status INTO v_status_before FROM public.billing_subscriptions WHERE id = v_sub_id;
    v_result := public.rpc_admin_pause_subscription(v_sub_id,'resume',NULL,'M54.2-P6.4 QA admin resume');
    SELECT status INTO v_status_after FROM public.billing_subscriptions WHERE id = v_sub_id;
    SELECT id INTO v_audit_id FROM public.billing_subscription_trace_audit
      WHERE subscription_id = v_sub_id AND (action ILIKE '%resume%' OR action ILIKE '%reactiv%') ORDER BY created_at DESC LIMIT 1;
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, status_before, status_after, audit_row_id, verdict, details)
    VALUES ('M54.2-P6.4-T3-admin-resume', v_sub_id, 'rpc_admin_pause_subscription(resume)',
      v_status_before, v_status_after, v_audit_id,
      CASE WHEN v_status_after = 'active' THEN 'PASS' ELSE 'FAIL' END,
      COALESCE(v_result,'{}'::jsonb));
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, verdict, error)
    VALUES ('M54.2-P6.4-T3-admin-resume', v_sub_id, 'rpc_admin_pause_subscription(resume)', 'FAIL', SQLERRM);
  END;

  ---------- T4 — Client pause request ----------
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_customer_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub',v_customer_id::text,'role','authenticated')::text, true);
    SELECT status INTO v_status_before FROM public.billing_subscriptions WHERE id = v_sub_id;
    v_susp_id := public.rpc_client_request_subscription_pause(
      v_sub_id,'M54.2-P6.4 QA client pause',14,(now()+interval '3 days')::date,'runtime E2E');
    SELECT status INTO v_status_after FROM public.billing_subscriptions WHERE id = v_sub_id;
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, status_before, status_after, audit_row_id, verdict, details)
    VALUES ('M54.2-P6.4-T4-client-pause', v_sub_id, 'rpc_client_request_subscription_pause',
      v_status_before, v_status_after, v_susp_id,
      CASE WHEN v_susp_id IS NOT NULL THEN 'PASS' ELSE 'FAIL' END,
      jsonb_build_object('suspension_request_id', v_susp_id));
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, verdict, error)
    VALUES ('M54.2-P6.4-T4-client-pause', v_sub_id, 'rpc_client_request_subscription_pause', 'FAIL', SQLERRM);
  END;

  ---------- T5 — Security suspend ----------
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin_id::text,'role','authenticated')::text, true);
    SELECT status INTO v_status_before FROM public.billing_subscriptions WHERE id = v_sub_id;
    PERFORM public.suspend_subscription(v_sub_id,'M54.2-P6.4 QA security suspend',NULL,jsonb_build_object('source','qa_e2e','test','T5'));
    SELECT status INTO v_status_after FROM public.billing_subscriptions WHERE id = v_sub_id;
    SELECT id INTO v_audit_id FROM public.billing_subscription_trace_audit
      WHERE subscription_id = v_sub_id AND action ILIKE '%suspend%' ORDER BY created_at DESC LIMIT 1;
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, status_before, status_after, audit_row_id, verdict)
    VALUES ('M54.2-P6.4-T5-suspend', v_sub_id, 'suspend_subscription',
      v_status_before, v_status_after, v_audit_id,
      CASE WHEN v_status_after = 'suspended' THEN 'PASS' ELSE 'FAIL' END);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, verdict, error)
    VALUES ('M54.2-P6.4-T5-suspend', v_sub_id, 'suspend_subscription', 'FAIL', SQLERRM);
  END;

  ---------- T6 — Reactivate ----------
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin_id::text,'role','authenticated')::text, true);
    SELECT status INTO v_status_before FROM public.billing_subscriptions WHERE id = v_sub_id;
    PERFORM public.reactivate_subscription(v_sub_id,jsonb_build_object('source','qa_e2e','test','T6'));
    SELECT status INTO v_status_after FROM public.billing_subscriptions WHERE id = v_sub_id;
    SELECT id INTO v_audit_id FROM public.billing_subscription_trace_audit
      WHERE subscription_id = v_sub_id AND action ILIKE '%reactiv%' ORDER BY created_at DESC LIMIT 1;
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, status_before, status_after, audit_row_id, verdict)
    VALUES ('M54.2-P6.4-T6-reactivate', v_sub_id, 'reactivate_subscription',
      v_status_before, v_status_after, v_audit_id,
      CASE WHEN v_status_after = 'active' THEN 'PASS' ELSE 'FAIL' END);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, verdict, error)
    VALUES ('M54.2-P6.4-T6-reactivate', v_sub_id, 'reactivate_subscription', 'FAIL', SQLERRM);
  END;

  ---------- T7 — Referral attach ----------
  BEGIN
    v_count := public.rpc_apply_referral_discount(v_bc_id, v_order_id, 'QA-P64-REF', 5.00, 3);
    SELECT referral_discount_amount, referral_discount_months_remaining,
           referral_discount_active, referral_code_used
      INTO v_refc, v_refm, v_refact, v_refcode
      FROM public.billing_subscriptions WHERE id = v_sub_id;
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, verdict, details)
    VALUES ('M54.2-P6.4-T7-referral-attach', v_sub_id, 'rpc_apply_referral_discount',
      CASE WHEN v_count >= 1 AND v_refact = true AND v_refcode = 'QA-P64-REF' THEN 'PASS' ELSE 'FAIL' END,
      jsonb_build_object('rows_updated', v_count,
        'referral_discount_amount', v_refc,
        'referral_discount_months_remaining', v_refm,
        'referral_discount_active', v_refact,
        'referral_code_used', v_refcode));
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, verdict, error)
    VALUES ('M54.2-P6.4-T7-referral-attach', v_sub_id, 'rpc_apply_referral_discount', 'FAIL', SQLERRM);
  END;

  ---------- T8 — Mark not_renewed ----------
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin_id::text,'role','authenticated')::text, true);
    SELECT status INTO v_status_before FROM public.billing_subscriptions WHERE id = v_sub_id;
    PERFORM public.rpc_mark_subscription_not_renewed(v_sub_id,'M54.2-P6.4 QA not_renewed');
    SELECT status INTO v_status_after FROM public.billing_subscriptions WHERE id = v_sub_id;
    SELECT id INTO v_audit_id FROM public.billing_subscription_trace_audit
      WHERE subscription_id = v_sub_id AND action ILIKE '%not_renew%' ORDER BY created_at DESC LIMIT 1;
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, status_before, status_after, audit_row_id, verdict)
    VALUES ('M54.2-P6.4-T8-not-renewed', v_sub_id, 'rpc_mark_subscription_not_renewed',
      v_status_before, v_status_after, v_audit_id,
      CASE WHEN v_status_after = 'not_renewed' THEN 'PASS' ELSE 'FAIL' END);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, verdict, error)
    VALUES ('M54.2-P6.4-T8-not-renewed', v_sub_id, 'rpc_mark_subscription_not_renewed', 'FAIL', SQLERRM);
  END;

  ---------- T9 — Cancel ----------
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin_id::text,'role','authenticated')::text, true);
    SELECT status INTO v_status_before FROM public.billing_subscriptions WHERE id = v_sub_id;
    PERFORM public.cancel_subscription(v_sub_id,'M54.2-P6.4 QA cancel',jsonb_build_object('source','qa_e2e','test','T9'));
    SELECT status INTO v_status_after FROM public.billing_subscriptions WHERE id = v_sub_id;
    SELECT id INTO v_audit_id FROM public.billing_subscription_trace_audit
      WHERE subscription_id = v_sub_id AND action ILIKE '%cancel%' ORDER BY created_at DESC LIMIT 1;
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, status_before, status_after, audit_row_id, verdict)
    VALUES ('M54.2-P6.4-T9-cancel', v_sub_id, 'cancel_subscription',
      v_status_before, v_status_after, v_audit_id,
      CASE WHEN v_status_after IN ('cancelled','canceled') THEN 'PASS' ELSE 'FAIL' END);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','',true);
    INSERT INTO public.qa_module54_e2e_log(scenario, subscription_id, rpc_called, verdict, error)
    VALUES ('M54.2-P6.4-T9-cancel', v_sub_id, 'cancel_subscription', 'FAIL', SQLERRM);
  END;
END $harness$;
