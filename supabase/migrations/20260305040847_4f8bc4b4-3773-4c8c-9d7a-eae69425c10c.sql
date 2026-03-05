
-- Test order 90001: set to completed (PayPal scenario)
-- Use DO block with exception handling to identify the failing trigger
DO $$
BEGIN
  UPDATE orders SET status = 'completed', payment_status = 'paid', updated_at = NOW()
  WHERE id = 'aaaaaaaa-0001-0000-0000-000000000001';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error updating order 90001: % %', SQLERRM, SQLSTATE;
  -- Insert alert with the error
  INSERT INTO billing_system_alerts (alert_type, entity_type, entity_id, details)
  VALUES ('debug_error', 'order', 'aaaaaaaa-0001-0000-0000-000000000001',
    jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE));
END;
$$;
