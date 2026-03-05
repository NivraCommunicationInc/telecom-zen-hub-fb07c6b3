
-- Test Scenario A: PayPal paid (order 90001)
DO $$
BEGIN
  UPDATE orders SET status = 'completed', payment_status = 'paid', updated_at = NOW()
  WHERE id = 'aaaaaaaa-0001-0000-0000-000000000001';
  RAISE NOTICE 'Order 90001 updated successfully';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error 90001: % [%]', SQLERRM, SQLSTATE;
  INSERT INTO billing_system_alerts (alert_type, entity_type, entity_id, details)
  VALUES ('debug_error', 'order', '90001', jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE));
END;
$$;

-- Test Scenario B: Promo 99% Interac (order 90002)
DO $$
BEGIN
  UPDATE orders SET status = 'completed', payment_status = 'paid', updated_at = NOW()
  WHERE id = 'aaaaaaaa-0002-0000-0000-000000000002';
  RAISE NOTICE 'Order 90002 updated successfully';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error 90002: % [%]', SQLERRM, SQLSTATE;
  INSERT INTO billing_system_alerts (alert_type, entity_type, entity_id, details)
  VALUES ('debug_error', 'order', '90002', jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE));
END;
$$;

-- Test Scenario C: promo_free $0 (order 90003)
DO $$
BEGIN
  UPDATE orders SET status = 'completed', payment_status = 'authorized', updated_at = NOW()
  WHERE id = 'aaaaaaaa-0003-0000-0000-000000000003';
  RAISE NOTICE 'Order 90003 updated successfully';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error 90003: % [%]', SQLERRM, SQLSTATE;
  INSERT INTO billing_system_alerts (alert_type, entity_type, entity_id, details)
  VALUES ('debug_error', 'order', '90003', jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE));
END;
$$;
