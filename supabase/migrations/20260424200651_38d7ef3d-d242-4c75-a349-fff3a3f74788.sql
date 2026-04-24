DO $$
DECLARE
  test_numbers text[] := ARRAY['69650','85604','80658','29393','24019','89304','47148','97700','21892'];
  test_order_ids uuid[];
  test_invoice_ids uuid[];
BEGIN
  SELECT ARRAY_AGG(id) INTO test_order_ids
  FROM orders WHERE order_number = ANY(test_numbers);

  IF test_order_ids IS NULL OR array_length(test_order_ids, 1) = 0 THEN
    RAISE NOTICE 'No matching test orders found';
    RETURN;
  END IF;

  SELECT ARRAY_AGG(id) INTO test_invoice_ids
  FROM billing_invoices WHERE order_id = ANY(test_order_ids);

  SET LOCAL session_replication_role = replica;

  IF test_invoice_ids IS NOT NULL THEN
    DELETE FROM billing_invoice_lines WHERE invoice_id = ANY(test_invoice_ids);
    DELETE FROM billing_payments WHERE invoice_id = ANY(test_invoice_ids);
  END IF;
  DELETE FROM billing_invoices WHERE order_id = ANY(test_order_ids);
  DELETE FROM billing_subscriptions WHERE order_id = ANY(test_order_ids);
  DELETE FROM sales_commissions WHERE converted_order_id = ANY(test_order_ids);
  DELETE FROM order_items WHERE order_id = ANY(test_order_ids);
  DELETE FROM staff_notifications WHERE entity_type = 'order' AND entity_id = ANY(test_order_ids);
  DELETE FROM field_payment_intents WHERE converted_order_id = ANY(test_order_ids);
  DELETE FROM orders WHERE id = ANY(test_order_ids);
END $$;