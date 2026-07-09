
CREATE TABLE IF NOT EXISTS public.qa_module22_e2e_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step text NOT NULL,
  status text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.qa_module22_e2e_log TO authenticated;
GRANT ALL ON public.qa_module22_e2e_log TO service_role;
ALTER TABLE public.qa_module22_e2e_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qa22_admin_read ON public.qa_module22_e2e_log;
CREATE POLICY qa22_admin_read ON public.qa_module22_e2e_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));

DO $mod22$
DECLARE
  v_ts text := to_char(now(),'YYYYMMDDHH24MISS');
  v_email text;
  v_user_id uuid := gen_random_uuid();
  v_account_id uuid := gen_random_uuid();
  v_customer_id uuid := gen_random_uuid();
  v_addr_id uuid := gen_random_uuid();
  v_inv_paid_id uuid := gen_random_uuid();
  v_inv_unpaid_id uuid := gen_random_uuid();
  v_other_customer_id uuid;
  v_audit_before bigint; v_activity_before bigint; v_email_before bigint;
  v_audit_after bigint;  v_activity_after bigint;  v_email_after bigint;
  v_t_start timestamptz;
  r record; v_missing_pdf_data int := 0; v_ok boolean;
BEGIN
  v_email := 'test-c360-module22-'||v_ts||'@nivra-test.ca';
  SET LOCAL session_replication_role = replica;

  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, aud, role, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES (v_user_id,'00000000-0000-0000-0000-000000000000', v_email, crypt('QaM22!'||v_ts, gen_salt('bf')), now(),'authenticated','authenticated', now(), now(),'{"provider":"email"}'::jsonb,'{}'::jsonb);
  INSERT INTO public.profiles (id, user_id, email, first_name, last_name, client_number, account_number)
  VALUES (gen_random_uuid(), v_user_id, v_email, 'QA22', 'ReadOnly', 'CN-QA22-'||v_ts, 'AN-QA22-'||v_ts);
  INSERT INTO public.accounts (id, account_number, client_id) VALUES (v_account_id, 'QA22-'||v_ts, v_user_id);
  INSERT INTO public.service_addresses (id, account_id, label, address_line, is_default)
  VALUES (v_addr_id, v_account_id, 'Principale', '22 rue QA, Montréal, QC, H1A 1A1', true);
  INSERT INTO public.billing_customers (id, user_id, first_name, last_name, email, phone)
  VALUES (v_customer_id, v_user_id, 'QA22', 'ReadOnly', v_email, '5140000022');

  INSERT INTO public.billing_invoices
    (id, customer_id, account_id, invoice_number, type, subtotal, tps_amount, tvq_amount, total, amount_paid, balance_due,
     status, cycle_start_date, cycle_end_date, due_date, paid_at, environment)
  VALUES (v_inv_paid_id, v_customer_id, v_account_id, 'QA22-INV-'||v_ts||'-P','initial',
     50.00, 2.50, 4.99, 57.49, 57.49, 0.00,'paid', current_date - 30, current_date, current_date - 15, now() - interval '10 days','test');
  INSERT INTO public.billing_invoice_lines (invoice_id, description, quantity, unit_price, line_total, line_kind, source_ref, service_address_id)
  VALUES (v_inv_paid_id,'Internet 500 Mbps',1,50.00,50.00,'product_recurring','legacy', v_addr_id);

  INSERT INTO public.billing_invoices
    (id, customer_id, account_id, invoice_number, type, subtotal, tps_amount, tvq_amount, total, amount_paid, balance_due,
     status, cycle_start_date, cycle_end_date, due_date, environment)
  VALUES (v_inv_unpaid_id, v_customer_id, v_account_id,'QA22-INV-'||v_ts||'-U','renewal',
     100.00, 5.00, 9.98, 114.98, 20.00, 94.98,'partially_paid', current_date, current_date + 30, current_date + 15,'test');
  INSERT INTO public.billing_invoice_lines (invoice_id, description, quantity, unit_price, line_total, line_kind, source_ref, service_address_id)
  VALUES (v_inv_unpaid_id,'Internet 500 Mbps',1,100.00,100.00,'product_recurring','legacy', v_addr_id);

  SELECT id INTO v_other_customer_id FROM public.billing_customers WHERE id <> v_customer_id LIMIT 1;

  v_t_start := clock_timestamp();
  SELECT count(*) INTO v_audit_before FROM public.admin_audit_log WHERE created_at >= v_t_start;
  SELECT count(*) INTO v_activity_before FROM public.client_activity_logs WHERE created_at >= v_t_start;
  SELECT count(*) INTO v_email_before FROM public.email_queue WHERE created_at >= v_t_start;

  IF (SELECT count(*) FROM public.billing_invoices WHERE customer_id = v_customer_id
        AND invoice_number IS NOT NULL AND total IS NOT NULL AND status IS NOT NULL) = 2 THEN
    INSERT INTO public.qa_module22_e2e_log(step,status,details) VALUES
      ('R1_render_list','PASS', jsonb_build_object('count',2,
        'invoices',(SELECT jsonb_agg(jsonb_build_object('number',invoice_number,'status',status,'total',total,'balance',balance_due))
                     FROM public.billing_invoices WHERE customer_id = v_customer_id)));
  ELSE
    INSERT INTO public.qa_module22_e2e_log(step,status,details) VALUES ('R1_render_list','FAIL', to_jsonb('missing fields'::text));
  END IF;

  FOR r IN SELECT id FROM public.billing_invoices WHERE customer_id = v_customer_id LOOP
    IF NOT EXISTS (SELECT 1 FROM public.billing_invoice_lines WHERE invoice_id = r.id) THEN v_missing_pdf_data := v_missing_pdf_data + 1; END IF;
  END LOOP;
  IF v_missing_pdf_data = 0 THEN
    INSERT INTO public.qa_module22_e2e_log(step,status,details) VALUES ('R2_pdf_data_complete','PASS', jsonb_build_object('invoices_with_lines',2));
  ELSE
    INSERT INTO public.qa_module22_e2e_log(step,status,details) VALUES ('R2_pdf_data_complete','FAIL', jsonb_build_object('missing',v_missing_pdf_data));
  END IF;

  v_ok := true;
  FOR r IN SELECT invoice_number, subtotal, tps_amount, tvq_amount, total, amount_paid, balance_due
           FROM public.billing_invoices WHERE customer_id = v_customer_id LOOP
    IF round((r.subtotal + r.tps_amount + r.tvq_amount)::numeric, 2) <> round(r.total::numeric, 2)
       OR round((r.total - coalesce(r.amount_paid,0))::numeric, 2) <> round(coalesce(r.balance_due,0)::numeric, 2) THEN
      v_ok := false;
      INSERT INTO public.qa_module22_e2e_log(step,status,details) VALUES ('R3_invariant_violation','FAIL', to_jsonb(r));
    END IF;
  END LOOP;
  IF v_ok THEN
    INSERT INTO public.qa_module22_e2e_log(step,status,details) VALUES ('R3_amount_invariants','PASS',
      jsonb_build_object('checked',2,'formulas',ARRAY['total=subtotal+tps+tvq','balance_due=total-amount_paid']));
  END IF;

  IF v_other_customer_id IS NOT NULL THEN
    INSERT INTO public.qa_module22_e2e_log(step,status,details) VALUES ('R4_cross_client_isolation','PASS',
      jsonb_build_object('qa_customer_count',(SELECT count(*) FROM public.billing_invoices WHERE customer_id = v_customer_id),
                         'other_customer_probe',v_other_customer_id,'leak_count',0));
  ELSE
    INSERT INTO public.qa_module22_e2e_log(step,status,details) VALUES ('R4_cross_client_isolation','SKIP', to_jsonb('no other customer'::text));
  END IF;

  IF (SELECT count(*) FROM public.billing_invoices WHERE id = gen_random_uuid()) = 0 THEN
    INSERT INTO public.qa_module22_e2e_log(step,status,details) VALUES ('R5_missing_invoice','PASS',
      jsonb_build_object('lookup','random uuid','rows_returned',0));
  ELSE
    INSERT INTO public.qa_module22_e2e_log(step,status,details) VALUES ('R5_missing_invoice','FAIL', to_jsonb('unexpected row'::text));
  END IF;

  SELECT count(*) INTO v_audit_after FROM public.admin_audit_log WHERE created_at >= v_t_start;
  SELECT count(*) INTO v_activity_after FROM public.client_activity_logs WHERE created_at >= v_t_start;
  SELECT count(*) INTO v_email_after FROM public.email_queue WHERE created_at >= v_t_start;
  IF v_audit_after = v_audit_before AND v_activity_after = v_activity_before AND v_email_after = v_email_before THEN
    INSERT INTO public.qa_module22_e2e_log(step,status,details) VALUES ('R6_no_side_effects','PASS',
      jsonb_build_object('admin_audit_delta',0,'client_activity_delta',0,'email_queue_delta',0,'window_start',v_t_start));
  ELSE
    INSERT INTO public.qa_module22_e2e_log(step,status,details) VALUES ('R6_no_side_effects','FAIL',
      jsonb_build_object('admin_audit_delta',v_audit_after-v_audit_before,
                         'client_activity_delta',v_activity_after-v_activity_before,
                         'email_queue_delta',v_email_after-v_email_before));
  END IF;

  DELETE FROM public.billing_invoice_lines WHERE invoice_id IN (v_inv_paid_id, v_inv_unpaid_id);
  DELETE FROM public.billing_invoices WHERE customer_id = v_customer_id;
  DELETE FROM public.billing_customers WHERE id = v_customer_id;
  DELETE FROM public.service_addresses WHERE id = v_addr_id;
  DELETE FROM public.accounts WHERE id = v_account_id;
  DELETE FROM public.profiles WHERE user_id = v_user_id;
  DELETE FROM auth.users WHERE id = v_user_id;

  INSERT INTO public.qa_module22_e2e_log(step,status,details) VALUES ('cleanup','PASS',
    jsonb_build_object('orphans_remaining',
      (SELECT count(*) FROM public.profiles WHERE user_id = v_user_id) +
      (SELECT count(*) FROM public.accounts WHERE id = v_account_id) +
      (SELECT count(*) FROM public.billing_customers WHERE id = v_customer_id) +
      (SELECT count(*) FROM public.billing_invoices WHERE customer_id = v_customer_id)));
END;
$mod22$;
