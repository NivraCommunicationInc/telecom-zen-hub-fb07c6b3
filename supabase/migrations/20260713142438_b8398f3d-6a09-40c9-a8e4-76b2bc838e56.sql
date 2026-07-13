
DO $$
DECLARE
  v_orders uuid[] := ARRAY[
    '9c9c3533-e589-498b-8ac0-b91e76328df4'::uuid,
    '59489c79-f740-40ba-a7da-93da52b98e81'::uuid,
    'c02c0f9c-9406-48e5-84ed-f5bbf76f5ffe'::uuid
  ];
  v_intents uuid[] := ARRAY[
    'c59a0bd3-f30c-4ee7-a3b6-f1cf9594be84'::uuid,
    '90206a23-e7b4-44ec-bf9b-e41c08ec8a96'::uuid,
    'ec7bc243-5fc2-476c-bdad-6231542d3176'::uuid
  ];
  v_fso uuid[] := ARRAY[
    '74e410a2-b544-435a-9184-8e1599c97147'::uuid,
    '8f6a4e8e-59b2-47d6-b553-a883e5811bf4'::uuid,
    '698bbed9-a7fc-4c9e-9963-fc01be5352e1'::uuid
  ];
  v_quotes uuid[] := ARRAY[
    '23f1c430-0cb8-416c-af99-683df9497089'::uuid,
    'ed607caf-7bcd-451f-b076-0335ebfa6728'::uuid,
    '336fba33-25a0-4c5a-aeb8-7ae64c4c33ee'::uuid
  ];
  v_inv uuid[];
  v_sub uuid[];
BEGIN
  SELECT array_agg(id) INTO v_inv FROM public.billing_invoices WHERE order_id = ANY(v_orders);
  SELECT array_agg(id) INTO v_sub FROM public.billing_subscriptions WHERE order_id = ANY(v_orders);

  -- 1) Purge billing FIRST (garde-fou empêche de nuller order_id sur invoices)
  IF v_inv IS NOT NULL THEN
    DELETE FROM public.billing_invoice_lines WHERE invoice_id = ANY(v_inv);
    DELETE FROM public.billing_payments WHERE invoice_id = ANY(v_inv);
    DELETE FROM public.square_payment_attempts WHERE invoice_id = ANY(v_inv);
    DELETE FROM public.public_payment_links WHERE invoice_id = ANY(v_inv);
    DELETE FROM public.billing_invoices WHERE id = ANY(v_inv);
  END IF;
  IF v_sub IS NOT NULL THEN
    DELETE FROM public.billing_subscription_services WHERE subscription_id = ANY(v_sub);
    DELETE FROM public.billing_subscription_trace_audit WHERE subscription_id = ANY(v_sub);
    DELETE FROM public.square_payment_attempts WHERE subscription_id = ANY(v_sub);
    DELETE FROM public.billing_subscriptions WHERE id = ANY(v_sub);
  END IF;

  -- 2) Nullify soft references
  UPDATE public.field_sales_orders SET converted_order_id = NULL WHERE converted_order_id = ANY(v_orders);
  UPDATE public.quotes SET converted_order_id = NULL WHERE converted_order_id = ANY(v_orders);
  UPDATE public.sales_commissions SET converted_order_id = NULL WHERE converted_order_id = ANY(v_orders);
  UPDATE public.replacement_tickets SET linked_order_id = NULL WHERE linked_order_id = ANY(v_orders);
  UPDATE public.replacement_orders SET original_order_id = NULL WHERE original_order_id = ANY(v_orders);
  UPDATE public.work_orders SET linked_order_id = NULL WHERE linked_order_id = ANY(v_orders);
  UPDATE public.messages SET related_order_id = NULL WHERE related_order_id = ANY(v_orders);
  UPDATE public.support_tickets SET related_order_id = NULL WHERE related_order_id = ANY(v_orders);
  UPDATE public.square_orphan_alerts SET linked_order_id = NULL WHERE linked_order_id = ANY(v_orders);
  UPDATE public.client_referrals SET referred_order_id = NULL WHERE referred_order_id = ANY(v_orders);
  UPDATE public.contest_entries SET order_id = NULL WHERE order_id = ANY(v_orders);
  UPDATE public.phone_inventory SET order_id = NULL WHERE order_id = ANY(v_orders);
  UPDATE public.equipment_inventory SET order_id = NULL WHERE order_id = ANY(v_orders);
  UPDATE public.billing SET order_id = NULL WHERE order_id = ANY(v_orders);
  UPDATE public.subscriptions SET order_id = NULL WHERE order_id = ANY(v_orders);
  UPDATE public.installations SET order_id = NULL WHERE order_id = ANY(v_orders);
  UPDATE public.crypto_payments SET order_id = NULL WHERE order_id = ANY(v_orders);
  UPDATE public.checkout_consent_records SET order_id = NULL WHERE order_id = ANY(v_orders);
  UPDATE public.equipment_return_requests SET order_id = NULL WHERE order_id = ANY(v_orders);
  UPDATE public.payments SET order_id = NULL WHERE order_id = ANY(v_orders);
  UPDATE public.technician_slot_bookings SET order_id = NULL WHERE order_id = ANY(v_orders);

  -- 3) Hard delete dependents (non-cascade)
  DELETE FROM public.contracts WHERE order_id = ANY(v_orders);
  DELETE FROM public.appointments WHERE order_id = ANY(v_orders);
  DELETE FROM public.installation_jobs WHERE order_id = ANY(v_orders);
  DELETE FROM public.identity_verification_sessions WHERE order_id = ANY(v_orders);
  DELETE FROM public.service_instances WHERE order_id = ANY(v_orders);
  DELETE FROM public.mobile_fulfillment WHERE order_id = ANY(v_orders);
  DELETE FROM public.inventory_assignments WHERE order_id = ANY(v_orders);
  DELETE FROM public.streaming_activation_tokens WHERE order_id = ANY(v_orders);
  DELETE FROM public.field_commissions WHERE order_id = ANY(v_orders);
  DELETE FROM public.provisioning_jobs WHERE order_id = ANY(v_orders);
  DELETE FROM public.installation_appointments WHERE order_id = ANY(v_orders);
  DELETE FROM public.equipment_order_lines WHERE order_id = ANY(v_orders);
  DELETE FROM public.order_status_history WHERE order_id = ANY(v_orders);
  DELETE FROM public.order_internal_notes WHERE order_id = ANY(v_orders);
  DELETE FROM public.order_snapshots WHERE order_id = ANY(v_orders);
  DELETE FROM public.order_identity_data WHERE order_id = ANY(v_orders);
  DELETE FROM public.order_documents WHERE order_id = ANY(v_orders);
  DELETE FROM public.order_automation_log WHERE order_id = ANY(v_orders);
  DELETE FROM public.order_items WHERE order_id = ANY(v_orders);
  DELETE FROM public.channel_selections WHERE order_id = ANY(v_orders);
  DELETE FROM public.technician_assignments WHERE order_id = ANY(v_orders);
  DELETE FROM public.fulfillment_snapshots WHERE order_id = ANY(v_orders);
  DELETE FROM public.kyc_requests WHERE order_id = ANY(v_orders);
  DELETE FROM public.shipments WHERE order_id = ANY(v_orders);
  DELETE FROM public.phone_orders WHERE order_id = ANY(v_orders);

  -- 4) Field sales chain
  DELETE FROM public.field_order_events WHERE intent_id = ANY(v_intents);
  DELETE FROM public.field_order_status_history WHERE field_order_id = ANY(v_fso);
  DELETE FROM public.field_order_notes WHERE field_order_id = ANY(v_fso);
  DELETE FROM public.field_order_sync_events WHERE field_order_id = ANY(v_fso);
  DELETE FROM public.field_sales_orders WHERE id = ANY(v_fso);
  DELETE FROM public.field_payment_intents WHERE id = ANY(v_intents);

  -- 5) Quotes chain
  DELETE FROM public.quote_lines WHERE quote_id = ANY(v_quotes);
  DELETE FROM public.quote_adjustments WHERE quote_id = ANY(v_quotes);
  DELETE FROM public.quote_events WHERE quote_id = ANY(v_quotes);
  DELETE FROM public.quote_approvals WHERE quote_id = ANY(v_quotes);
  DELETE FROM public.field_quotes WHERE id = ANY(v_quotes);

  -- 6) Finally, orders
  DELETE FROM public.orders WHERE id = ANY(v_orders);
END $$;
