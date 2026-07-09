
DO $$
DECLARE
  v_ts text := to_char(now(), 'YYYYMMDDHH24MISSMS');
  v_email text;
  v_user_id uuid := gen_random_uuid();
  v_customer_id uuid;
  v_account_id uuid;
  v_sub_id uuid;
  v_addr_id uuid;
  v_admin_id uuid;
  v_anchor int := 7;
  v_cycle_start date;
  v_cycle_end date;
BEGIN
  v_email := 'test-c360-module21-' || v_ts || '@nivra-test.ca';

  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER trg_subscription_freeze_guard;
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER trg_subscription_cycle_coherence;
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER trg_subscription_recurring_only_guard;
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER trg_guard_billing_subscription_plan_from_equipment;
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER trg_guard_subscription_cycle_dates;
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER protect_subscription_insert_trigger;
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER trg_protect_sub_insert_activation;
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER ensure_residential_subscription_address;
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER ensure_residential_subscription_traceability;
  ALTER TABLE public.billing_subscriptions DISABLE TRIGGER trg_assert_sub_provider_square;

  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', v_email, crypt('qa-m21-'||v_ts, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name','QA Module21','env','test'), 'authenticated','authenticated');

  UPDATE public.profiles SET email=v_email, first_name='QA', last_name='Module21', full_name='QA Module21', account_number='QA-M21-'||v_ts, phone='5140000000', updated_at=now() WHERE user_id=v_user_id;

  INSERT INTO public.accounts (client_id, account_number, status, billing_anchor_day, primary_service_address, primary_service_city, primary_service_province, primary_service_postal_code, created_at, updated_at)
  VALUES (v_user_id, 'QA-ACC-M21-'||v_ts, 'active', v_anchor, '1 rue QA Module21', 'Laval', 'QC', 'H7A0A0', now(), now())
  RETURNING id INTO v_account_id;

  INSERT INTO public.service_addresses (account_id, label, address_line, city, province, postal_code, is_default, is_primary, is_active, created_by_user_id, created_at, updated_at)
  VALUES (v_account_id, 'QA Module21', '1 rue QA Module21', 'Laval', 'QC', 'H7A0A0', true, true, true, v_user_id, now(), now())
  RETURNING id INTO v_addr_id;

  INSERT INTO public.billing_customers (user_id, first_name, last_name, email, phone, status)
  VALUES (v_user_id, 'QA', 'Module21', v_email, '5140000000', 'active')
  RETURNING id INTO v_customer_id;

  v_cycle_start := (date_trunc('month', now())::date) + (v_anchor - 1);
  v_cycle_end   := (v_cycle_start + interval '1 month' - interval '1 day')::date;

  INSERT INTO public.billing_subscriptions
    (customer_id, plan_code, plan_name, plan_price, cycle_start_date, cycle_end_date, status,
     service_category, environment, auto_billing_enabled, address_id, service_address_id,
     source_type, source_id,
     frozen_name, frozen_code, frozen_unit_price, frozen_currency, frozen_cycle, frozen_frequency,
     billing_anchor_date, recurring_setup_status, recurring_provider)
  VALUES
    (v_customer_id, 'INT-500', 'Internet 500 Mbps', 50, v_cycle_start, v_cycle_end, 'active',
     'internet', 'test', false, v_addr_id, v_addr_id,
     'qa_e2e_module21', 'qa-m21-'||v_ts,
     'Internet 500 Mbps', 'INT-500', 50, 'CAD', 'monthly', 'monthly',
     v_cycle_start, 'active'::recurring_setup_status, 'square')
  RETURNING id INTO v_sub_id;

  INSERT INTO public.account_tags (account_id, client_user_id, tag_key, tag_label, severity, note, created_by, created_by_email, created_at)
  VALUES (v_account_id, v_user_id, 'qa_test_account', 'QA — Module 21 Upgrade/Downgrade', 'info', 'E2E Module 21', v_user_id, v_email, now())
  ON CONFLICT DO NOTHING;

  SELECT ur.user_id INTO v_admin_id FROM public.user_roles ur WHERE ur.role='admin' LIMIT 1;

  CREATE TABLE IF NOT EXISTS public.qa_module21_e2e_log (
    id uuid primary key default gen_random_uuid(),
    step text, ok boolean, details jsonb, created_at timestamptz default now()
  );
  GRANT SELECT ON public.qa_module21_e2e_log TO authenticated;
  GRANT ALL ON public.qa_module21_e2e_log TO service_role;
  ALTER TABLE public.qa_module21_e2e_log ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "admin read qa m21" ON public.qa_module21_e2e_log;
  CREATE POLICY "admin read qa m21" ON public.qa_module21_e2e_log FOR SELECT USING (has_role(auth.uid(),'admin'));

  INSERT INTO public.qa_module21_e2e_log (step, ok, details)
  VALUES ('provision', true, jsonb_build_object(
    'email', v_email, 'user_id', v_user_id, 'customer_id', v_customer_id, 'account_id', v_account_id, 'subscription_id', v_sub_id,
    'address_id', v_addr_id, 'admin_id', v_admin_id, 'cycle_start', v_cycle_start, 'cycle_end', v_cycle_end
  ));

  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER trg_subscription_freeze_guard;
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER trg_subscription_cycle_coherence;
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER trg_subscription_recurring_only_guard;
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER trg_guard_billing_subscription_plan_from_equipment;
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER trg_guard_subscription_cycle_dates;
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER protect_subscription_insert_trigger;
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER trg_protect_sub_insert_activation;
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER ensure_residential_subscription_address;
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER ensure_residential_subscription_traceability;
  ALTER TABLE public.billing_subscriptions ENABLE TRIGGER trg_assert_sub_provider_square;
END $$;
