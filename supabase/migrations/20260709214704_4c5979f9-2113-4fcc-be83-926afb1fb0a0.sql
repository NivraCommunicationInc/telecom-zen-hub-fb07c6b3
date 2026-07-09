
INSERT INTO public.suppressed_emails (email, reason)
SELECT DISTINCT to_email, 'bounce'
FROM public.email_queue
WHERE to_email LIKE '%@nivra-test.ca'
ON CONFLICT DO NOTHING;

SET session_replication_role = replica;

DO $$
DECLARE
  v_user_id uuid := '63e97ee3-fd6b-44e7-9478-16ad898a6ec7';
  v_customer_id uuid := 'b51ac994-2f7f-4b2d-b621-0c91e922d783';
  v_account_id uuid := '15177218-6b4e-4513-9196-634c8c4bca37';
BEGIN
  DELETE FROM public.billing_invoice_lines WHERE invoice_id IN (SELECT id FROM public.billing_invoices WHERE customer_id = v_customer_id);
  DELETE FROM public.billing_invoices WHERE customer_id = v_customer_id;
  DELETE FROM public.service_change_requests WHERE account_id = v_account_id;
  DELETE FROM public.billing_subscriptions WHERE customer_id = v_customer_id;
  DELETE FROM public.billing_customers WHERE id = v_customer_id;
  DELETE FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE account_id = v_account_id);
  DELETE FROM public.orders WHERE account_id = v_account_id;
  DELETE FROM public.admin_audit_log WHERE target_id = v_account_id;
  DELETE FROM public.client_activity_logs WHERE client_id = v_user_id;
  DELETE FROM public.client_internal_notes WHERE client_id = v_user_id;
  DELETE FROM public.email_queue WHERE to_email = 'test-c360-module21-20260709213926441@nivra-test.ca';
  DELETE FROM public.account_tags WHERE account_id = v_account_id;
  DELETE FROM public.service_addresses WHERE account_id = v_account_id;
  DELETE FROM public.accounts WHERE id = v_account_id;
  DELETE FROM public.profiles WHERE user_id = v_user_id;
  DELETE FROM auth.users WHERE id = v_user_id;
END $$;

SET session_replication_role = origin;
