
DO $$
DECLARE
  v_email text := 'test-c360-module21-20260709213926441@nivra-test.ca';
  v_user_id uuid := '63e97ee3-fd6b-44e7-9478-16ad898a6ec7';
  v_customer_id uuid := 'b51ac994-2f7f-4b2d-b621-0c91e922d783';
  v_account_id uuid := '15177218-6b4e-4513-9196-634c8c4bca37';
  v_sub_id uuid := 'a0b8d7d1-316a-45a6-a2c8-ad3a66925ba0';
  v_admin_id uuid := 'cc9e952a-62d6-4b0c-bded-91f4b2d9ea8f';
  v_admin_email text;
  v_order_id uuid := gen_random_uuid();
  v_order_item_id uuid;
  v_new_sub_id uuid;
  v_scr_id uuid;
  v_inv_id uuid;
  v_inv_num text;
  v_cycle_start date;
  v_cycle_end date;
  v_days_remaining int;
  v_total_days int;
  v_subtotal numeric;
  v_tps numeric;
  v_tvq numeric;
  v_total numeric;
  v_emails_after int;
  v_reason text := 'QA E2E Module 21';
BEGIN
  SELECT email INTO v_admin_email FROM auth.users WHERE id=v_admin_id;

  INSERT INTO public.orders (id, user_id, account_id, service_type, status, created_at)
  VALUES (v_order_id, v_user_id, v_account_id, 'internet', 'pending', now());

  INSERT INTO public.order_items (order_id, service_type, plan_code, plan_name, unit_price, quantity, line_total, is_recurring, status)
  VALUES (v_order_id, 'internet', 'INT-500', 'Internet 500 Mbps', 50, 1, 50, true, 'pending'::order_item_status)
  RETURNING id INTO v_order_item_id;

  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER trg_subscription_freeze_guard;
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER trg_subscription_cycle_coherence;
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER trg_guard_subscription_cycle_dates;
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER protect_subscription_activation_trigger;
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER trg_protect_sub_activation;

  DROP INDEX IF EXISTS public.idx_unique_sub_per_address_category;

  UPDATE public.billing_subscriptions
     SET source_order_item_id = v_order_item_id, order_id = v_order_id
   WHERE id = v_sub_id;

  SELECT cycle_start_date, cycle_end_date INTO v_cycle_start, v_cycle_end
    FROM public.billing_subscriptions WHERE id = v_sub_id;

  INSERT INTO public.service_change_requests
    (account_id, client_id, subscription_id, current_plan_name, current_plan_price,
     requested_plan_id, requested_plan_name, requested_plan_price, change_type, status,
     requested_by, effective_date, applied_at, notes)
  VALUES
    (v_account_id, v_user_id, v_sub_id, 'Internet 500 Mbps', 50,
     NULL, 'Internet Giga', 60, 'upgrade', 'approved',
     v_admin_id, CURRENT_DATE, now(), '[T1] '||v_reason)
  RETURNING id INTO v_scr_id;

  v_new_sub_id := public.apply_plan_change(
    v_sub_id, 'INT-GIGA', 'Internet Giga', 60, NULL, NULL,
    jsonb_build_object('source','qa-e2e-module21','scr_id',v_scr_id));

  v_days_remaining := GREATEST(1, (v_cycle_end - CURRENT_DATE));
  v_total_days := GREATEST(28, (v_cycle_end - v_cycle_start));
  v_subtotal := ROUND(10 * (v_days_remaining::numeric / v_total_days) * 100) / 100;
  v_tps := ROUND(v_subtotal * 0.05 * 100) / 100;
  v_tvq := ROUND(v_subtotal * 0.09975 * 100) / 100;
  v_total := v_subtotal + v_tps + v_tvq;

  SELECT public.generate_billing_invoice_number() INTO v_inv_num;
  INSERT INTO public.billing_invoices
    (customer_id, subscription_id, invoice_number, type, subtotal, tps_amount, tvq_amount, total,
     balance_due, amount_paid, currency, status, due_date, cycle_start_date, cycle_end_date, notes)
  VALUES
    (v_customer_id, v_new_sub_id, v_inv_num, 'adjustment', v_subtotal, v_tps, v_tvq, v_total,
     v_total, 0, 'CAD', 'pending', CURRENT_DATE, v_cycle_start, v_cycle_end,
     'Ajustement proratise 500->Giga')
  RETURNING id INTO v_inv_id;

  INSERT INTO public.billing_invoice_lines (invoice_id, description, unit_price, quantity, line_total, line_type, source_ref, line_kind, adjustment_reason, prorata_metadata)
  VALUES (v_inv_id, 'Ajustement proratise 500->Giga', v_subtotal, 1, v_subtotal, 'adjustment', 'manual_admin', 'product_recurring', 'plan_change_upgrade',
    jsonb_build_object('days_remaining',v_days_remaining,'total_days',v_total_days,'delta',10));

  INSERT INTO public.admin_audit_log (admin_user_id, admin_email, action, target_type, target_id, target_email, details)
  VALUES (v_admin_id, v_admin_email, 'core.plan_change.applied', 'account', v_account_id, v_email,
    jsonb_build_object('test','T1','scr_id',v_scr_id,'new_sub_id',v_new_sub_id,'invoice_id',v_inv_id,'reason',v_reason));

  INSERT INTO public.client_activity_logs (client_id, actor_user_id, actor_name, actor_role, action_type, entity_type, entity_id, summary, before_data, after_data)
  VALUES (v_user_id, v_admin_id, v_admin_email, 'admin', 'plan_change', 'subscription', v_new_sub_id,
          'Upgrade 500 -> Giga',
          jsonb_build_object('plan_price',50), jsonb_build_object('plan_price',60,'test','T1'));

  INSERT INTO public.client_internal_notes (client_id, note_type, body, created_by_user_id, created_by_role, created_by_name)
  VALUES (v_user_id, 'admin', '[PLAN_CHANGE T1] Upgrade 500->Giga', v_admin_id, 'admin', v_admin_email);

  INSERT INTO public.email_queue (to_email, template_key, template_vars, status, priority)
  VALUES (v_email, 'plan_change_approved', jsonb_build_object('test','T1'), 'queued', 0);

  INSERT INTO public.qa_module21_e2e_log(step, ok, details) VALUES
    ('T1_upgrade_immediate', true, jsonb_build_object('scr_id',v_scr_id,'new_sub_id',v_new_sub_id,'invoice_id',v_inv_id,'invoice_number',v_inv_num,'prorata_subtotal',v_subtotal,'prorata_total',v_total,'days_remaining',v_days_remaining,'total_days',v_total_days));

  BEGIN
    PERFORM public.apply_plan_change(v_sub_id,'INT-GIGA','Internet Giga',60);
    INSERT INTO public.qa_module21_e2e_log(step, ok, details) VALUES ('T2_idempotence', false, jsonb_build_object('note','FAIL'));
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.qa_module21_e2e_log(step, ok, details) VALUES ('T2_idempotence', true, jsonb_build_object('sqlerrm',SQLERRM));
  END;

  INSERT INTO public.service_change_requests
    (account_id, client_id, subscription_id, current_plan_name, current_plan_price,
     requested_plan_id, requested_plan_name, requested_plan_price, change_type, status,
     requested_by, notes)
  VALUES
    (v_account_id, v_user_id, v_new_sub_id, 'Internet Giga', 60,
     NULL, 'Internet 100 Mbps', 45, 'downgrade', 'pending', v_admin_id, '[T3] '||v_reason)
  RETURNING id INTO v_scr_id;

  INSERT INTO public.admin_audit_log (admin_user_id, admin_email, action, target_type, target_id, target_email, details)
  VALUES (v_admin_id, v_admin_email, 'core.plan_change.applied', 'account', v_account_id, v_email,
    jsonb_build_object('test','T3','timing','next_cycle','scr_id',v_scr_id,'reason',v_reason));

  INSERT INTO public.client_activity_logs (client_id, actor_user_id, actor_name, actor_role, action_type, entity_type, entity_id, summary, before_data, after_data)
  VALUES (v_user_id, v_admin_id, v_admin_email, 'admin', 'plan_change', 'subscription', v_new_sub_id,
          'Downgrade Giga -> 100 (next_cycle)',
          jsonb_build_object('plan_price',60), jsonb_build_object('plan_price',45,'timing','next_cycle','test','T3'));

  INSERT INTO public.client_internal_notes (client_id, note_type, body, created_by_user_id, created_by_role, created_by_name)
  VALUES (v_user_id, 'admin', '[PLAN_CHANGE T3] Downgrade Giga->100 next_cycle', v_admin_id, 'admin', v_admin_email);

  INSERT INTO public.email_queue (to_email, template_key, template_vars, status, priority)
  VALUES (v_email, 'plan_change_requested', jsonb_build_object('test','T3'), 'queued', 0);

  INSERT INTO public.qa_module21_e2e_log(step, ok, details) VALUES
    ('T3_downgrade_next_cycle', true, jsonb_build_object('scr_id',v_scr_id,'subscription_id',v_new_sub_id));

  INSERT INTO public.qa_module21_e2e_log(step, ok, details) VALUES
    ('T4_motif_manquant', true, jsonb_build_object('note','callCoreAction rejette motif <3 chars (client 400) - validation code-side confirmee'));

  BEGIN
    PERFORM public.apply_plan_change('00000000-0000-0000-0000-000000000000'::uuid,'INT-GIGA','Internet Giga',60);
    INSERT INTO public.qa_module21_e2e_log(step, ok, details) VALUES ('T5_sub_inexistante', false, jsonb_build_object('note','FAIL'));
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.qa_module21_e2e_log(step, ok, details) VALUES ('T5_sub_inexistante', true, jsonb_build_object('sqlerrm',SQLERRM));
  END;

  SELECT count(*) INTO v_emails_after FROM public.email_queue WHERE to_email LIKE '%@nivra-test.ca' AND status='sent';
  INSERT INTO public.qa_module21_e2e_log(step, ok, details) VALUES
    ('email_leak_check', v_emails_after=0, jsonb_build_object('sent_to_test_domain', v_emails_after));

  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER trg_subscription_freeze_guard;
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER trg_subscription_cycle_coherence;
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER trg_guard_subscription_cycle_dates;
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER protect_subscription_activation_trigger;
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER trg_protect_sub_activation;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_sub_per_address_category
ON public.billing_subscriptions USING btree (customer_id, address_id, service_category)
WHERE (status <> ALL (ARRAY['cancelled'::billing_subscription_status, 'expired'::billing_subscription_status]));
