
DO $$
DECLARE
  v_account_id uuid := '6c163bc0-0831-40d9-a27f-91b80d59a73a';
  v_client_id  uuid := 'd97815e8-d35a-4f71-a2c0-0b5e1af5bbd2';
  v_addr_id    uuid;
  v_order_id   uuid;
  v_item_id    uuid;
  v_sub_id     uuid;
  v_start      date := CURRENT_DATE;
  v_end        date := (CURRENT_DATE + INTERVAL '1 month')::date - 1;
  v_anchor_ts  timestamptz := date_trunc('day', now());
BEGIN
  UPDATE public.accounts
     SET status='active', cancelled_at=NULL, cancellation_reason=NULL, updated_at=now()
   WHERE id = v_account_id;

  INSERT INTO public.account_tags (account_id, client_user_id, tag_key, tag_label, severity, note)
  SELECT v_account_id, v_client_id, 'qa_test_account', 'Compte QA C360', 'info', 'QA isolé.'
  WHERE NOT EXISTS (SELECT 1 FROM public.account_tags WHERE account_id=v_account_id AND tag_key='qa_test_account');

  SELECT id INTO v_addr_id FROM public.service_addresses
   WHERE account_id=v_account_id AND deleted_at IS NULL ORDER BY created_at LIMIT 1;
  IF v_addr_id IS NULL THEN
    INSERT INTO public.service_addresses (account_id, label, address_line, city, province, postal_code, is_primary, is_active, is_default, created_via)
    VALUES (v_account_id, 'Résidence QA', '123 QA Test', 'Laval', 'QC', 'H7A 1A1', true, true, true, 'admin')
    RETURNING id INTO v_addr_id;
  END IF;

  INSERT INTO public.billing_customers (id, first_name, last_name, email, phone, autopay_enabled, autopay_discount_active)
  VALUES (v_client_id, 'QA', 'C360-v2', 'test-c360-planchange-v2@nivra-test.ca', '+15140000000', false, false)
  ON CONFLICT (id) DO NOTHING;

  DELETE FROM public.email_queue
   WHERE template_key IN ('review_request_activation','review_request_deactivation')
     AND to_email = 'test-c360-planchange-v2@nivra-test.ca';

  DELETE FROM public.billing_subscriptions WHERE customer_id=v_client_id;

  INSERT INTO public.orders (user_id, account_id, service_type, status, environment)
  VALUES (v_client_id, v_account_id, 'internet', 'active', 'test')
  RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (order_id, item_number, service_type, plan_name, unit_price, quantity, line_total, is_recurring, status)
  VALUES (v_order_id, 1, 'internet', 'Internet 500 Mbps', 50.00, 1, 50.00, true, 'active')
  RETURNING id INTO v_item_id;

  INSERT INTO public.billing_subscriptions (
    customer_id, plan_code, plan_name, plan_price, service_category, status, environment,
    cycle_start_date, cycle_end_date, billing_anchor_date, billing_cycle_anchor,
    auto_billing_enabled, service_address_id, address_id,
    source_type, source_id, source_order_item_id, order_id,
    frozen_name, frozen_code, frozen_unit_price, frozen_currency,
    frozen_cycle, frozen_frequency, frozen_anchor_date
  ) VALUES (
    v_client_id, 'internet_500', 'Internet 500 Mbps', 50.00, 'Internet', 'active', 'test',
    v_start, v_end, v_start, v_anchor_ts,
    false, v_addr_id, v_addr_id,
    'qa_provisioning', v_item_id, v_item_id, v_order_id,
    'Internet 500 Mbps', 'internet_500', 50.00, 'CAD',
    'monthly', 'monthly', v_start
  ) RETURNING id INTO v_sub_id;

  RAISE NOTICE 'QA seed ok: order=% item=% sub=% addr=%', v_order_id, v_item_id, v_sub_id, v_addr_id;
END $$;
