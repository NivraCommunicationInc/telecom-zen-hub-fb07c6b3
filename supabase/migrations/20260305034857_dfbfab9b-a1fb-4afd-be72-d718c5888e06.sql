-- Apply test payments via canonical RPC
SELECT apply_payment_to_invoice(
  p_invoice_id := '237cc10a-8029-483c-901b-130352ec436d'::uuid,
  p_amount := 46.68, p_method := 'interac', p_provider := 'manual_test',
  p_provider_payment_id := 'audit_test99_proof', p_source := 'test',
  p_created_by_name := 'Audit E2E', p_created_by_role := 'admin',
  p_customer_id := 'b329a12f-d456-487a-ab91-c5221360458b'::uuid
);

SELECT apply_payment_to_invoice(
  p_invoice_id := '25d54c3d-8dbc-447d-83a2-aca99bcd6dbf'::uuid,
  p_amount := 57.49, p_method := 'interac', p_provider := 'manual_test',
  p_provider_payment_id := 'audit_save50_proof', p_source := 'test',
  p_created_by_name := 'Audit E2E', p_created_by_role := 'admin',
  p_customer_id := 'b329a12f-d456-487a-ab91-c5221360458b'::uuid
);