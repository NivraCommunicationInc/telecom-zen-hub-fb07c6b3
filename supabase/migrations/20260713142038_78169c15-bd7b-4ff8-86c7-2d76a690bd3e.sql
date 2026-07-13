
-- Cibles: 3 commandes doublons (24778, 28032, 43562)
-- IDs: 9c9c3533-e589-498b-8ac0-b91e76328df4, 59489c79-f740-40ba-a7da-93da52b98e81, c02c0f9c-9406-48e5-84ed-f5bbf76f5ffe
-- Intents: c59a0bd3-f30c-4ee7-a3b6-f1cf9594be84, 90206a23-e7b4-44ec-bf9b-e41c08ec8a96, ec7bc243-5fc2-476c-bdad-6231542d3176
-- FSO: 74e410a2-b544-435a-9184-8e1599c97147, 8f6a4e8e-59b2-47d6-b553-a883e5811bf4, 698bbed9-a7fc-4c9e-9963-fc01be5352e1
-- Quotes: 23f1c430-0cb8-416c-af99-683df9497089, ed607caf-7bcd-451f-b076-0335ebfa6728, 336fba33-25a0-4c5a-aeb8-7ae64c4c33ee

DO $$
DECLARE
  v_order_ids uuid[] := ARRAY[
    '9c9c3533-e589-498b-8ac0-b91e76328df4'::uuid,
    '59489c79-f740-40ba-a7da-93da52b98e81'::uuid,
    'c02c0f9c-9406-48e5-84ed-f5bbf76f5ffe'::uuid
  ];
  v_intent_ids uuid[] := ARRAY[
    'c59a0bd3-f30c-4ee7-a3b6-f1cf9594be84'::uuid,
    '90206a23-e7b4-44ec-bf9b-e41c08ec8a96'::uuid,
    'ec7bc243-5fc2-476c-bdad-6231542d3176'::uuid
  ];
  v_fso_ids uuid[] := ARRAY[
    '74e410a2-b544-435a-9184-8e1599c97147'::uuid,
    '8f6a4e8e-59b2-47d6-b553-a883e5811bf4'::uuid,
    '698bbed9-a7fc-4c9e-9963-fc01be5352e1'::uuid
  ];
  v_quote_ids uuid[] := ARRAY[
    '23f1c430-0cb8-416c-af99-683df9497089'::uuid,
    'ed607caf-7bcd-451f-b076-0335ebfa6728'::uuid,
    '336fba33-25a0-4c5a-aeb8-7ae64c4c33ee'::uuid
  ];
  v_invoice_ids uuid[];
  v_sub_ids uuid[];
BEGIN
  -- Collecte des IDs enfants
  SELECT array_agg(id) INTO v_invoice_ids FROM public.billing_invoices WHERE order_id = ANY(v_order_ids);
  SELECT array_agg(id) INTO v_sub_ids FROM public.billing_subscriptions WHERE order_id = ANY(v_order_ids);

  -- 1) Enfants de factures
  IF v_invoice_ids IS NOT NULL THEN
    DELETE FROM public.billing_invoice_lines WHERE invoice_id = ANY(v_invoice_ids);
    DELETE FROM public.ledger_invoice_allocations WHERE invoice_id = ANY(v_invoice_ids);
    DELETE FROM public.billing_payments WHERE invoice_id = ANY(v_invoice_ids);
  END IF;

  -- 2) Enfants d'abonnements
  IF v_sub_ids IS NOT NULL THEN
    DELETE FROM public.billing_subscription_services WHERE subscription_id = ANY(v_sub_ids);
    DELETE FROM public.billing_subscription_trace_audit WHERE subscription_id = ANY(v_sub_ids);
  END IF;

  -- 3) Enfants de commandes
  DELETE FROM public.order_items WHERE order_id = ANY(v_order_ids);
  DELETE FROM public.order_status_history WHERE order_id = ANY(v_order_ids);
  DELETE FROM public.order_internal_notes WHERE order_id = ANY(v_order_ids);
  DELETE FROM public.order_snapshots WHERE order_id = ANY(v_order_ids);
  DELETE FROM public.order_identity_data WHERE order_id = ANY(v_order_ids);
  DELETE FROM public.order_documents WHERE order_id = ANY(v_order_ids);
  DELETE FROM public.order_automation_log WHERE order_id = ANY(v_order_ids);
  DELETE FROM public.equipment_order_lines WHERE order_id = ANY(v_order_ids);
  DELETE FROM public.appointments WHERE order_id = ANY(v_order_ids);
  DELETE FROM public.installation_appointments WHERE order_id = ANY(v_order_ids);
  DELETE FROM public.installation_jobs WHERE order_id = ANY(v_order_ids);
  DELETE FROM public.provisioning_jobs WHERE order_id = ANY(v_order_ids);
  DELETE FROM public.field_order_sync_events WHERE core_order_id = ANY(v_order_ids);

  -- 4) Field sales orders + events
  IF v_fso_ids IS NOT NULL THEN
    DELETE FROM public.field_order_events WHERE field_sales_order_id = ANY(v_fso_ids);
    DELETE FROM public.field_order_status_history WHERE field_sales_order_id = ANY(v_fso_ids);
    DELETE FROM public.field_order_notes WHERE field_sales_order_id = ANY(v_fso_ids);
    DELETE FROM public.field_commissions WHERE field_sales_order_id = ANY(v_fso_ids);
  END IF;
  DELETE FROM public.field_sales_orders WHERE id = ANY(v_fso_ids);

  -- 5) Intents + quotes
  DELETE FROM public.square_payment_attempts WHERE field_payment_intent_id = ANY(v_intent_ids);
  DELETE FROM public.public_payment_attempts WHERE field_payment_intent_id = ANY(v_intent_ids);
  DELETE FROM public.public_payment_links WHERE field_payment_intent_id = ANY(v_intent_ids);
  DELETE FROM public.field_payment_intents WHERE id = ANY(v_intent_ids);
  DELETE FROM public.quote_lines WHERE quote_id = ANY(v_quote_ids);
  DELETE FROM public.quote_adjustments WHERE quote_id = ANY(v_quote_ids);
  DELETE FROM public.quote_events WHERE quote_id = ANY(v_quote_ids);
  DELETE FROM public.quote_approvals WHERE quote_id = ANY(v_quote_ids);
  DELETE FROM public.field_quotes WHERE id = ANY(v_quote_ids);

  -- 6) Factures + abonnements + email_queue
  DELETE FROM public.billing_invoices WHERE order_id = ANY(v_order_ids);
  DELETE FROM public.billing_subscriptions WHERE order_id = ANY(v_order_ids);
  DELETE FROM public.email_queue WHERE order_id = ANY(v_order_ids);

  -- 7) La commande elle-même
  DELETE FROM public.orders WHERE id = ANY(v_order_ids);

  RAISE NOTICE 'Suppression doublons: 3 commandes purgées';
EXCEPTION WHEN undefined_table OR undefined_column THEN
  -- Ignore les tables qui n'existent pas dans cet environnement
  RAISE NOTICE 'Certaines tables enfants inexistantes — poursuite';
END $$;
