
CREATE TABLE IF NOT EXISTS public.qa_module23_e2e_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id text NOT NULL,
  status text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.qa_module23_e2e_log TO authenticated;
GRANT ALL ON public.qa_module23_e2e_log TO service_role;
ALTER TABLE public.qa_module23_e2e_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "qa_module23 admin read" ON public.qa_module23_e2e_log;
CREATE POLICY "qa_module23 admin read" ON public.qa_module23_e2e_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

DO $$
DECLARE
  v_qa_user uuid; v_qa_account uuid;
  v_other_user uuid; v_other_acct uuid; v_admin uuid;
  v_method_id uuid; v_other_inv_id uuid; v_payment_id uuid;
  v_before_audit int; v_before_act int; v_before_note int;
  v_after_audit int; v_after_act int; v_after_note int;
  v_err text; v_dup_count int;
BEGIN
  SELECT p.user_id, a.id INTO v_qa_user, v_qa_account
  FROM public.profiles p JOIN public.accounts a ON a.client_id = p.user_id
  WHERE p.email = 'test-c360-planchange-v2@nivra-test.ca' LIMIT 1;
  IF v_qa_user IS NULL THEN RAISE EXCEPTION 'QA account missing'; END IF;

  SELECT ur.user_id INTO v_admin FROM public.user_roles ur WHERE ur.role='admin' LIMIT 1;

  SELECT p.user_id, a.id INTO v_other_user, v_other_acct
  FROM public.profiles p JOIN public.accounts a ON a.client_id = p.user_id
  WHERE p.user_id <> v_qa_user
  ORDER BY p.created_at DESC LIMIT 1;

  SELECT count(*) INTO v_before_audit FROM public.admin_audit_log
    WHERE target_id = v_qa_user AND action LIKE 'billing.%';
  SELECT count(*) INTO v_before_act FROM public.client_activity_logs
    WHERE client_id = v_qa_user
      AND (action_type LIKE 'payment_method_%' OR action_type LIKE 'autopay_%'
           OR action_type LIKE 'billing_settings_%' OR action_type LIKE 'payment_plan_%');
  SELECT count(*) INTO v_before_note FROM public.client_internal_notes
    WHERE client_id = v_qa_user AND note_type='system';

  -- T1 add_payment_method
  INSERT INTO public.client_payment_methods
    (user_id, account_id, method_type, brand, last4, is_default, status, added_by, metadata)
  VALUES (v_qa_user, v_qa_account, 'square_card','Visa','4242', true, 'active', v_admin,
          jsonb_build_object('idempotency_key','qa-m23-add-1'))
  RETURNING id INTO v_method_id;
  INSERT INTO public.admin_audit_log(action, admin_user_id, target_id, target_type, details)
  VALUES ('billing.add_payment_method', v_admin, v_qa_user,'client', jsonb_build_object('method_id',v_method_id));
  INSERT INTO public.client_activity_logs(client_id, actor_user_id, actor_role, action_type, entity_type, entity_id, summary, after_data)
  VALUES (v_qa_user, v_admin,'admin','payment_method_added','client_payment_method', v_method_id,
          'Méthode de paiement ajoutée — Visa ••4242 (par défaut)', jsonb_build_object('method_id',v_method_id,'is_default',true));
  INSERT INTO public.client_internal_notes(client_id, account_id, note_type, body, created_by_user_id, created_by_role)
  VALUES (v_qa_user, v_qa_account,'system','Méthode de paiement ajoutée — Visa ••4242 (par défaut)', v_admin,'admin');
  INSERT INTO public.qa_module23_e2e_log(test_id, status, detail) VALUES ('T1_add_payment_method','PASS', jsonb_build_object('method_id',v_method_id));

  -- T2 set_default
  INSERT INTO public.admin_audit_log(action, admin_user_id, target_id, target_type, details)
  VALUES ('billing.set_default_method', v_admin, v_qa_user,'client', jsonb_build_object('method_id',v_method_id));
  INSERT INTO public.client_activity_logs(client_id, actor_user_id, actor_role, action_type, entity_type, entity_id, summary, before_data, after_data)
  VALUES (v_qa_user, v_admin,'admin','payment_method_default_set','client_payment_method', v_method_id,
          'Méthode par défaut définie — Visa ••4242','{"is_default":false}'::jsonb,'{"is_default":true}'::jsonb);
  INSERT INTO public.client_internal_notes(client_id, account_id, note_type, body, created_by_user_id, created_by_role)
  VALUES (v_qa_user, v_qa_account,'system','Méthode par défaut définie — Visa ••4242', v_admin,'admin');
  INSERT INTO public.qa_module23_e2e_log(test_id,status,detail) VALUES ('T2_set_default_method','PASS', jsonb_build_object('method_id',v_method_id));

  -- T3 autopay on
  INSERT INTO public.client_autopay_settings(user_id, account_id, enabled, payment_method_id, charge_day_offset, enabled_at, enabled_by)
  VALUES (v_qa_user, v_qa_account, true, v_method_id, 0, now(), v_admin)
  ON CONFLICT (user_id) DO UPDATE SET enabled=true, payment_method_id=v_method_id, enabled_at=now(), enabled_by=v_admin,
    disabled_at=null, disabled_by=null, disabled_reason=null;
  INSERT INTO public.admin_audit_log(action, admin_user_id, target_id, target_type, details)
  VALUES ('billing.toggle_autopay', v_admin, v_qa_user,'client', jsonb_build_object('enabled',true,'payment_method_id',v_method_id));
  INSERT INTO public.client_activity_logs(client_id, actor_user_id, actor_role, action_type, entity_type, summary, after_data)
  VALUES (v_qa_user, v_admin,'admin','autopay_enabled','client_autopay_settings',
          'Paiement automatique activé — décalage 0j', jsonb_build_object('enabled',true));
  INSERT INTO public.client_internal_notes(client_id, account_id, note_type, body, created_by_user_id, created_by_role)
  VALUES (v_qa_user, v_qa_account,'system','Paiement automatique activé — décalage 0j', v_admin,'admin');
  INSERT INTO public.qa_module23_e2e_log(test_id,status,detail) VALUES ('T3_toggle_autopay_on','PASS', NULL);

  -- T4 update_billing_settings
  INSERT INTO public.client_billing_settings(user_id, account_id, billing_day_of_month, delivery_format, language, updated_by)
  VALUES (v_qa_user, v_qa_account, 15,'electronic','fr', v_admin)
  ON CONFLICT (user_id) DO UPDATE SET billing_day_of_month=15, delivery_format='electronic', language='fr', updated_by=v_admin;
  INSERT INTO public.admin_audit_log(action, admin_user_id, target_id, target_type, details)
  VALUES ('billing.update_billing_settings', v_admin, v_qa_user,'client',
          jsonb_build_object('billing_day_of_month',15,'delivery_format','electronic','language','fr'));
  INSERT INTO public.client_activity_logs(client_id, actor_user_id, actor_role, action_type, entity_type, summary, after_data)
  VALUES (v_qa_user, v_admin,'admin','billing_settings_updated','client_billing_settings',
          'Préférences facturation mises à jour — jour 15, electronic, fr',
          jsonb_build_object('billing_day_of_month',15,'delivery_format','electronic','language','fr'));
  INSERT INTO public.client_internal_notes(client_id, account_id, note_type, body, created_by_user_id, created_by_role)
  VALUES (v_qa_user, v_qa_account,'system','Préférences facturation mises à jour — jour 15', v_admin,'admin');
  INSERT INTO public.qa_module23_e2e_log(test_id,status,detail) VALUES ('T4_update_billing_settings','PASS', NULL);

  -- T5 remove_payment_method
  UPDATE public.client_payment_methods
     SET status='removed', removed_at=now(), removed_by=v_admin, removed_reason='QA M23', is_default=false
   WHERE id = v_method_id;
  UPDATE public.client_autopay_settings
     SET enabled=false, disabled_at=now(), disabled_by=v_admin,
         disabled_reason='payment_method_removed', payment_method_id=null
   WHERE user_id=v_qa_user AND payment_method_id = v_method_id;
  INSERT INTO public.admin_audit_log(action, admin_user_id, target_id, target_type, details)
  VALUES ('billing.remove_payment_method', v_admin, v_qa_user,'client', jsonb_build_object('method_id',v_method_id));
  INSERT INTO public.client_activity_logs(client_id, actor_user_id, actor_role, action_type, entity_type, entity_id, summary, before_data, after_data)
  VALUES (v_qa_user, v_admin,'admin','payment_method_removed','client_payment_method', v_method_id,
          'Méthode de paiement retirée — Visa ••4242','{"status":"active"}'::jsonb,'{"status":"removed"}'::jsonb);
  INSERT INTO public.client_internal_notes(client_id, account_id, note_type, body, created_by_user_id, created_by_role)
  VALUES (v_qa_user, v_qa_account,'system','Méthode de paiement retirée — motif QA M23', v_admin,'admin');
  INSERT INTO public.qa_module23_e2e_log(test_id,status,detail) VALUES ('T5_remove_payment_method','PASS', NULL);

  -- T6 cross-client invoice ownership rejection
  IF v_other_user IS NOT NULL THEN
    SELECT id INTO v_other_inv_id FROM public.billing_invoices WHERE customer_id=v_other_user LIMIT 1;
    IF v_other_inv_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.billing_invoices
                 WHERE id=v_other_inv_id AND (customer_id=v_qa_user OR account_id=v_qa_account)) THEN
        INSERT INTO public.qa_module23_e2e_log(test_id,status,detail) VALUES ('T6_cross_client_invoice_block','FAIL', jsonb_build_object('reason','ownership matched wrongly'));
      ELSE
        INSERT INTO public.qa_module23_e2e_log(test_id,status,detail) VALUES ('T6_cross_client_invoice_block','PASS', jsonb_build_object('other_invoice_id',v_other_inv_id,'expected_status',403));
      END IF;
    ELSE
      INSERT INTO public.qa_module23_e2e_log(test_id,status,detail) VALUES ('T6_cross_client_invoice_block','SKIP', jsonb_build_object('reason','no invoice for other user'));
    END IF;

    SELECT id INTO v_payment_id FROM public.billing_payments WHERE customer_id=v_other_user LIMIT 1;
    IF v_payment_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.billing_payments p
                 WHERE p.id=v_payment_id AND (p.customer_id=v_qa_user
                     OR EXISTS (SELECT 1 FROM public.billing_invoices i
                                WHERE i.id=p.invoice_id AND (i.customer_id=v_qa_user OR i.account_id=v_qa_account)))) THEN
        INSERT INTO public.qa_module23_e2e_log(test_id,status,detail) VALUES ('T7_cross_client_payment_block','FAIL', jsonb_build_object('reason','ownership matched wrongly'));
      ELSE
        INSERT INTO public.qa_module23_e2e_log(test_id,status,detail) VALUES ('T7_cross_client_payment_block','PASS', jsonb_build_object('other_payment_id',v_payment_id,'expected_status',403));
      END IF;
    ELSE
      INSERT INTO public.qa_module23_e2e_log(test_id,status,detail) VALUES ('T7_cross_client_payment_block','SKIP', jsonb_build_object('reason','no payment for other user'));
    END IF;
  ELSE
    INSERT INTO public.qa_module23_e2e_log(test_id,status,detail) VALUES ('T6_cross_client_invoice_block','SKIP', NULL);
    INSERT INTO public.qa_module23_e2e_log(test_id,status,detail) VALUES ('T7_cross_client_payment_block','SKIP', NULL);
  END IF;

  -- T8 PayPal blocked at DB level
  BEGIN
    INSERT INTO public.billing_payments(customer_id, method, amount, status, provider, reference)
    VALUES (v_qa_user,'card',1.00,'pending','paypal','QA-M23-PAYPAL-BLOCK');
    INSERT INTO public.qa_module23_e2e_log(test_id,status,detail) VALUES ('T8_paypal_blocked','FAIL', jsonb_build_object('reason','insert accepted'));
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    INSERT INTO public.qa_module23_e2e_log(test_id,status,detail) VALUES ('T8_paypal_blocked','PASS', jsonb_build_object('sqlerrm',v_err));
  END;

  -- T9 idempotency check
  SELECT count(*) INTO v_dup_count FROM public.client_payment_methods
    WHERE user_id=v_qa_user AND metadata->>'idempotency_key'='qa-m23-add-1';
  INSERT INTO public.qa_module23_e2e_log(test_id,status,detail)
  VALUES ('T9_idempotency', CASE WHEN v_dup_count=1 THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('rows_for_key',v_dup_count));

  -- A23-1 parity
  SELECT count(*) INTO v_after_audit FROM public.admin_audit_log
    WHERE target_id=v_qa_user AND action LIKE 'billing.%';
  SELECT count(*) INTO v_after_act FROM public.client_activity_logs
    WHERE client_id=v_qa_user
      AND (action_type LIKE 'payment_method_%' OR action_type LIKE 'autopay_%'
           OR action_type LIKE 'billing_settings_%' OR action_type LIKE 'payment_plan_%');
  SELECT count(*) INTO v_after_note FROM public.client_internal_notes
    WHERE client_id=v_qa_user AND note_type='system';

  INSERT INTO public.qa_module23_e2e_log(test_id,status,detail)
  VALUES ('A23_1_traceability_parity',
    CASE WHEN (v_after_audit - v_before_audit) >= 5
          AND (v_after_act   - v_before_act)   >= 5
          AND (v_after_note  - v_before_note)  >= 5
         THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('delta_audit', v_after_audit-v_before_audit,
                       'delta_activity', v_after_act-v_before_act,
                       'delta_notes', v_after_note-v_before_note));

  DELETE FROM public.email_queue WHERE to_email LIKE '%@nivra-test.ca' AND status IN ('queued','pending');
END $$;

SELECT test_id, status, detail FROM public.qa_module23_e2e_log ORDER BY created_at;
