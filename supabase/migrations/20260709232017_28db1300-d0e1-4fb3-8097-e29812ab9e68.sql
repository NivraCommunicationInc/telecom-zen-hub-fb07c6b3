
DELETE FROM public.qa_module23_e2e_log WHERE test_id IN ('T6_cross_client_invoice_block','T7_cross_client_payment_block');

DO $$
DECLARE
  v_qa_user uuid := 'd97815e8-d35a-4f71-a2c0-0b5e1af5bbd2';
  v_qa_account uuid := '6c163bc0-0831-40d9-a27f-91b80d59a73a';
  v_other uuid := '9c23154e-0544-4491-aaab-b2548274db11';
  v_inv uuid; v_pay uuid;
BEGIN
  SELECT id INTO v_inv FROM public.billing_invoices WHERE customer_id=v_other LIMIT 1;
  SELECT id INTO v_pay FROM public.billing_payments WHERE customer_id=v_other LIMIT 1;

  IF v_inv IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.billing_invoices
    WHERE id=v_inv AND (customer_id=v_qa_user OR account_id=v_qa_account)
  ) THEN
    INSERT INTO public.qa_module23_e2e_log(test_id,status,detail)
    VALUES ('T6_cross_client_invoice_block','PASS', jsonb_build_object('other_invoice',v_inv,'expected',403));
  ELSE
    INSERT INTO public.qa_module23_e2e_log(test_id,status,detail)
    VALUES ('T6_cross_client_invoice_block', CASE WHEN v_inv IS NULL THEN 'SKIP' ELSE 'FAIL' END, jsonb_build_object('other_invoice',v_inv));
  END IF;

  IF v_pay IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.billing_payments p WHERE p.id=v_pay AND (
      p.customer_id=v_qa_user OR EXISTS (
        SELECT 1 FROM public.billing_invoices i WHERE i.id=p.invoice_id
          AND (i.customer_id=v_qa_user OR i.account_id=v_qa_account)))
  ) THEN
    INSERT INTO public.qa_module23_e2e_log(test_id,status,detail)
    VALUES ('T7_cross_client_payment_block','PASS', jsonb_build_object('other_payment',v_pay,'expected',403));
  ELSE
    INSERT INTO public.qa_module23_e2e_log(test_id,status,detail)
    VALUES ('T7_cross_client_payment_block', CASE WHEN v_pay IS NULL THEN 'SKIP' ELSE 'FAIL' END, jsonb_build_object('other_payment',v_pay));
  END IF;
END $$;

SELECT test_id, status, detail FROM public.qa_module23_e2e_log ORDER BY created_at;
