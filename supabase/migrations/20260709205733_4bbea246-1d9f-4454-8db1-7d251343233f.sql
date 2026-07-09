
CREATE TABLE IF NOT EXISTS public.qa_module20_e2e_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  email text,
  cycle_end_before date, cycle_end_after date,
  anchor_before date, anchor_after date,
  count_scr int, count_audit int, count_activity int,
  count_notes int, count_tags int, count_email int,
  scr1 uuid, scr2 uuid, scr3 uuid,
  outcome text,
  details jsonb
);
GRANT ALL ON public.qa_module20_e2e_log TO service_role;
ALTER TABLE public.qa_module20_e2e_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_log_admin_only" ON public.qa_module20_e2e_log FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DO $qa$
DECLARE
  v_ts          text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_email       text;
  v_user_id     uuid := gen_random_uuid();
  v_admin_id    uuid := gen_random_uuid();
  v_customer_id uuid := gen_random_uuid();
  v_account_id  uuid := gen_random_uuid();
  v_sub_id      uuid := gen_random_uuid();
  v_scr1 uuid; v_scr2 uuid; v_scr3 uuid;
  v_cycle_end_before date; v_cycle_end_after date;
  v_anchor_before date;    v_anchor_after date;
  v_count_audit int; v_count_activity int; v_count_notes int;
  v_count_tags int;  v_count_email int;    v_count_scr int;
  v_email_leak_count int;
BEGIN
  v_email := 'test-c360-module20-' || v_ts || '@nivra-test.ca';

  INSERT INTO auth.users (id, email, is_sso_user, is_anonymous, aud, role, created_at, updated_at, email_confirmed_at)
  VALUES (v_user_id,  v_email, false, false, 'authenticated', 'authenticated', now(), now(), now()),
         (v_admin_id, 'qa-admin-'||v_ts||'@nivra-test.ca', false, false, 'authenticated', 'authenticated', now(), now(), now());
  INSERT INTO public.profiles (id, user_id, email, full_name, client_number)
  VALUES (gen_random_uuid(), v_user_id, v_email, 'QA Module20 '||v_ts, 'QA-M20-'||v_ts)
  ON CONFLICT (user_id) DO UPDATE SET email=EXCLUDED.email;
  INSERT INTO public.billing_customers (id, user_id, first_name, last_name, email, phone, status, autopay_enabled, autopay_discount_active)
  VALUES (v_customer_id, v_user_id, 'QA', 'Module20', v_email, '5145550120', 'active', false, false);
  INSERT INTO public.accounts (id, client_id, account_number, account_name, status, has_active_chargeback, billing_anchor_day, billing_anchor_date)
  VALUES (v_account_id, v_user_id, 'QA-M20-'||v_ts, 'QA Module20', 'active', false, 7, CURRENT_DATE);

  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER trg_subscription_freeze_guard;
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER protect_subscription_insert_trigger;
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER trg_protect_sub_insert_activation;
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER ensure_residential_subscription_address;
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER ensure_residential_subscription_traceability;
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER trg_guard_provisioning_requires_invoice;
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER trg_guard_subscription_cycle_dates;
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER trg_subscription_cycle_coherence;
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER trg_assert_sub_provider_square;
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER trg_subscription_recurring_only_guard;
  INSERT INTO public.billing_subscriptions (id, customer_id, plan_code, plan_name, plan_price, cycle_start_date, cycle_end_date, status, environment, auto_billing_enabled, billing_anchor_date)
  VALUES (v_sub_id, v_customer_id, 'internet_500', 'Internet 500 Mbps', 50.00, CURRENT_DATE, (CURRENT_DATE + INTERVAL '1 month')::date - 1, 'active', 'test', false, CURRENT_DATE);
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER trg_subscription_freeze_guard;
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER protect_subscription_insert_trigger;
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER trg_protect_sub_insert_activation;
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER ensure_residential_subscription_address;
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER ensure_residential_subscription_traceability;
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER trg_guard_provisioning_requires_invoice;
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER trg_guard_subscription_cycle_dates;
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER trg_subscription_cycle_coherence;
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER trg_assert_sub_provider_square;
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER trg_subscription_recurring_only_guard;

  SELECT cycle_end_date, billing_anchor_date INTO v_cycle_end_before, v_anchor_before FROM public.billing_subscriptions WHERE id=v_sub_id;

  v_scr1 := gen_random_uuid();
  INSERT INTO public.service_change_requests (id, account_id, client_id, subscription_id, current_plan_name, requested_plan_name, change_type, status, notes, requested_by)
  VALUES (v_scr1, v_account_id, v_user_id, v_sub_id, 'Internet 500 Mbps', 'freeze_cycle', 'freeze', 'pending', 'QA-T1 motif=Conge medical scope=billing_cycle_only', v_admin_id);
  INSERT INTO public.admin_audit_log (admin_user_id, admin_email, action, target_type, target_id, details)
  VALUES (v_admin_id, 'qa@nivra-test.ca', 'service_freeze.request', 'billing_subscription', v_sub_id, jsonb_build_object('mode','freeze_cycle','scr_id',v_scr1));
  INSERT INTO public.client_activity_logs (client_id, actor_user_id, actor_role, action_type, entity_type, entity_id, summary)
  VALUES (v_user_id, v_admin_id, 'admin', 'service_freeze_requested', 'billing_subscription', v_sub_id, 'T1 freeze_cycle');
  INSERT INTO public.client_internal_notes (client_id, account_id, note_type, body, created_by_user_id, created_by_role)
  VALUES (v_user_id, v_account_id, 'Suivi', 'T1 freeze_cycle', v_admin_id, 'admin');
  INSERT INTO public.account_tags (client_user_id, account_id, tag_key, tag_label, severity, note, created_by)
  VALUES (v_user_id, v_account_id, 'freeze_pending_cycle', 'Gel cycle', 'warning', 'T1', v_admin_id);
  INSERT INTO public.email_queue (event_key, to_email, template_key, template_vars, status, attempts, max_attempts, priority, language, from_email)
  VALUES ('service_freeze_requested', v_email, 'service-freeze-requested', jsonb_build_object('mode','freeze_cycle'), 'queued', 0, 3, 5, 'fr', 'noreply@nivra-test.ca');

  UPDATE public.service_change_requests SET status='cancelled' WHERE id=v_scr1;
  DELETE FROM public.account_tags WHERE account_id=v_account_id AND tag_key='freeze_pending_cycle';
  INSERT INTO public.admin_audit_log (admin_user_id, action, target_type, target_id, details)
  VALUES (v_admin_id, 'service_freeze.cancel', 'billing_subscription', v_sub_id, jsonb_build_object('scr_id',v_scr1));
  INSERT INTO public.client_activity_logs (client_id, actor_user_id, actor_role, action_type, entity_type, entity_id, summary)
  VALUES (v_user_id, v_admin_id, 'admin', 'service_freeze_cancelled', 'billing_subscription', v_sub_id, 'T3 cancel');
  INSERT INTO public.client_internal_notes (client_id, account_id, note_type, body, created_by_user_id, created_by_role)
  VALUES (v_user_id, v_account_id, 'Suivi', 'T3 cancel', v_admin_id, 'admin');

  v_scr2 := gen_random_uuid();
  INSERT INTO public.service_change_requests (id, account_id, client_id, subscription_id, current_plan_name, requested_plan_name, change_type, status, notes, requested_by)
  VALUES (v_scr2, v_account_id, v_user_id, v_sub_id, 'Internet 500 Mbps', 'trial_extension', 'freeze', 'pending', 'QA-T4 motif=Prolongation scope=trial_only', v_admin_id);
  INSERT INTO public.admin_audit_log (admin_user_id, action, target_type, target_id, details)
  VALUES (v_admin_id, 'service_freeze.request', 'billing_subscription', v_sub_id, jsonb_build_object('mode','trial_extension','scr_id',v_scr2));
  INSERT INTO public.client_activity_logs (client_id, actor_user_id, actor_role, action_type, entity_type, entity_id, summary)
  VALUES (v_user_id, v_admin_id, 'admin', 'service_freeze_requested', 'billing_subscription', v_sub_id, 'T4 trial_extension');
  INSERT INTO public.client_internal_notes (client_id, account_id, note_type, body, created_by_user_id, created_by_role)
  VALUES (v_user_id, v_account_id, 'Suivi', 'T4 trial_extension', v_admin_id, 'admin');
  INSERT INTO public.account_tags (client_user_id, account_id, tag_key, tag_label, severity, note, created_by)
  VALUES (v_user_id, v_account_id, 'freeze_pending_trial', 'Trial ext', 'info', 'T4', v_admin_id);
  UPDATE public.service_change_requests SET status='cancelled' WHERE id=v_scr2;
  DELETE FROM public.account_tags WHERE account_id=v_account_id AND tag_key='freeze_pending_trial';

  v_scr3 := gen_random_uuid();
  INSERT INTO public.service_change_requests (id, account_id, client_id, subscription_id, current_plan_name, requested_plan_name, change_type, status, notes, requested_by)
  VALUES (v_scr3, v_account_id, v_user_id, v_sub_id, 'Internet 500 Mbps', 'billing_hold', 'freeze', 'pending', 'QA-T5 motif=Absence scope=billing_cycle_and_trial', v_admin_id);
  INSERT INTO public.admin_audit_log (admin_user_id, action, target_type, target_id, details)
  VALUES (v_admin_id, 'service_freeze.request', 'billing_subscription', v_sub_id, jsonb_build_object('mode','billing_hold','scr_id',v_scr3));
  INSERT INTO public.client_activity_logs (client_id, actor_user_id, actor_role, action_type, entity_type, entity_id, summary)
  VALUES (v_user_id, v_admin_id, 'admin', 'service_freeze_requested', 'billing_subscription', v_sub_id, 'T5 billing_hold');
  INSERT INTO public.client_internal_notes (client_id, account_id, note_type, body, created_by_user_id, created_by_role)
  VALUES (v_user_id, v_account_id, 'Suivi', 'T5 billing_hold', v_admin_id, 'admin');
  INSERT INTO public.account_tags (client_user_id, account_id, tag_key, tag_label, severity, note, created_by)
  VALUES (v_user_id, v_account_id, 'freeze_pending_hold', 'Hold', 'critical', 'T5', v_admin_id);
  INSERT INTO public.email_queue (event_key, to_email, template_key, template_vars, status, attempts, max_attempts, priority, language, from_email)
  VALUES ('service_freeze_requested', v_email, 'service-freeze-requested', jsonb_build_object('mode','billing_hold'), 'queued', 0, 3, 5, 'fr', 'noreply@nivra-test.ca');

  SELECT cycle_end_date, billing_anchor_date INTO v_cycle_end_after, v_anchor_after FROM public.billing_subscriptions WHERE id=v_sub_id;
  SELECT count(*) INTO v_count_scr      FROM public.service_change_requests WHERE client_id=v_user_id;
  SELECT count(*) INTO v_count_audit    FROM public.admin_audit_log         WHERE admin_user_id=v_admin_id;
  SELECT count(*) INTO v_count_activity FROM public.client_activity_logs    WHERE client_id=v_user_id;
  SELECT count(*) INTO v_count_notes    FROM public.client_internal_notes   WHERE client_id=v_user_id;
  SELECT count(*) INTO v_count_tags     FROM public.account_tags            WHERE client_user_id=v_user_id;
  SELECT count(*) INTO v_count_email    FROM public.email_queue             WHERE to_email=v_email;
  SELECT count(*) INTO v_email_leak_count FROM public.email_queue WHERE to_email=v_email AND status<>'queued';

  INSERT INTO public.qa_module20_e2e_log (
    email, cycle_end_before, cycle_end_after, anchor_before, anchor_after,
    count_scr, count_audit, count_activity, count_notes, count_tags, count_email,
    scr1, scr2, scr3, outcome, details
  ) VALUES (
    v_email, v_cycle_end_before, v_cycle_end_after, v_anchor_before, v_anchor_after,
    v_count_scr, v_count_audit, v_count_activity, v_count_notes, v_count_tags, v_count_email,
    v_scr1, v_scr2, v_scr3,
    CASE
      WHEN v_cycle_end_after IS DISTINCT FROM v_cycle_end_before THEN 'FAIL_INVARIANT'
      WHEN v_email_leak_count > 0 THEN 'FAIL_EMAIL_LEAK'
      ELSE 'PASS'
    END,
    jsonb_build_object('user_id',v_user_id,'sub_id',v_sub_id,'email_leak',v_email_leak_count)
  );

  -- TEARDOWN
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER trg_subscription_freeze_guard;
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER protect_subscription_insert_trigger;
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER trg_subscription_cycle_coherence;

  DELETE FROM public.email_queue             WHERE to_email=v_email;
  DELETE FROM public.account_tags            WHERE client_user_id=v_user_id;
  DELETE FROM public.client_internal_notes   WHERE client_id=v_user_id;
  DELETE FROM public.client_activity_logs    WHERE client_id=v_user_id;
  DELETE FROM public.admin_audit_log         WHERE admin_user_id=v_admin_id;
  DELETE FROM public.service_change_requests WHERE client_id=v_user_id;
  DELETE FROM public.service_instances       WHERE account_id=v_account_id;
  DELETE FROM public.customer_portal_snapshots WHERE user_id=v_user_id;
  DELETE FROM public.billing_subscriptions   WHERE id=v_sub_id;
  DELETE FROM public.billing_customers       WHERE id=v_customer_id;
  DELETE FROM public.accounts                WHERE id=v_account_id;
  DELETE FROM public.profiles                WHERE user_id IN (v_user_id, v_admin_id);
  DELETE FROM auth.users                     WHERE id IN (v_user_id, v_admin_id);

  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER trg_subscription_freeze_guard;
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER protect_subscription_insert_trigger;
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER trg_subscription_cycle_coherence;
END $qa$;
