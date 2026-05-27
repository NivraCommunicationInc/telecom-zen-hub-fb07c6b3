CREATE OR REPLACE FUNCTION public.customer_portal_enrich_snapshot(_user_id uuid, _snapshot jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_snapshot jsonb := coalesce(_snapshot, '{}'::jsonb);
  v_ids jsonb := coalesce(v_snapshot->'identifiers', '{}'::jsonb);
  v_related_user_ids uuid[] := ARRAY[_user_id]::uuid[];
  v_account_ids uuid[] := ARRAY[]::uuid[];
  v_order_ids uuid[] := ARRAY[]::uuid[];
  v_ticket_ids uuid[] := ARRAY[]::uuid[];
  v_replacement_request_ticket_ids uuid[] := ARRAY[]::uuid[];
  v_thread_ids uuid[] := ARRAY[]::uuid[];
  v_payment_ids uuid[] := ARRAY[]::uuid[];
  v_ticket_replies jsonb := '[]'::jsonb;
  v_web_form_messages jsonb := '[]'::jsonb;
  v_order_items jsonb := '[]'::jsonb;
  v_equipment_order_lines jsonb := '[]'::jsonb;
  v_payment_disputes jsonb := '[]'::jsonb;
  v_activation_requests jsonb := '[]'::jsonb;
  v_account_service_locations jsonb := '[]'::jsonb;
  v_replacement_request_tickets jsonb := '[]'::jsonb;
  v_replacement_shipments jsonb := '[]'::jsonb;
  v_replacement_timeline jsonb := '[]'::jsonb;
  v_referral_codes jsonb := '[]'::jsonb;
  v_client_referrals jsonb := '[]'::jsonb;
  v_loyalty_rewards jsonb := '[]'::jsonb;
  v_paypal_autopay_attempts jsonb := '[]'::jsonb;
BEGIN
  SELECT coalesce(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_related_user_ids
  FROM jsonb_array_elements_text(coalesce(v_ids->'relatedUserIds', jsonb_build_array(_user_id))) AS value
  WHERE value ~* '^[0-9a-f-]{36}$';

  SELECT coalesce(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_account_ids
  FROM jsonb_array_elements_text(coalesce(v_ids->'accountIds', '[]'::jsonb)) AS value
  WHERE value ~* '^[0-9a-f-]{36}$';

  SELECT coalesce(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_order_ids
  FROM jsonb_array_elements_text(coalesce(v_ids->'orderIds', '[]'::jsonb)) AS value
  WHERE value ~* '^[0-9a-f-]{36}$';

  SELECT coalesce(array_agg(DISTINCT (t->>'id')::uuid), ARRAY[]::uuid[]) INTO v_ticket_ids
  FROM jsonb_array_elements(coalesce(v_snapshot->'supportTickets', '[]'::jsonb)) AS t
  WHERE t ? 'id' AND (t->>'id') ~* '^[0-9a-f-]{36}$';

  SELECT coalesce(array_agg(DISTINCT (w->>'id')::uuid), ARRAY[]::uuid[]) INTO v_thread_ids
  FROM jsonb_array_elements(coalesce(v_snapshot->'webFormThreads', '[]'::jsonb)) AS w
  WHERE w ? 'id' AND (w->>'id') ~* '^[0-9a-f-]{36}$';

  SELECT coalesce(array_agg(DISTINCT (p->>'id')::uuid), ARRAY[]::uuid[]) INTO v_payment_ids
  FROM jsonb_array_elements(coalesce(v_snapshot->'payments', '[]'::jsonb) || coalesce(v_snapshot->'legacyPayments', '[]'::jsonb)) AS p
  WHERE p ? 'id' AND (p->>'id') ~* '^[0-9a-f-]{36}$';

  SELECT coalesce(jsonb_agg(to_jsonb(tr) ORDER BY tr.created_at ASC NULLS LAST), '[]'::jsonb)
  INTO v_ticket_replies
  FROM public.ticket_replies tr
  WHERE coalesce(array_length(v_ticket_ids, 1), 0) > 0
    AND tr.ticket_id = ANY(v_ticket_ids);

  SELECT coalesce(jsonb_agg(to_jsonb(wfm) ORDER BY wfm.created_at ASC NULLS LAST), '[]'::jsonb)
  INTO v_web_form_messages
  FROM public.web_form_messages wfm
  WHERE coalesce(array_length(v_thread_ids, 1), 0) > 0
    AND wfm.thread_id = ANY(v_thread_ids)
    AND coalesce(wfm.is_internal_note, false) = false;

  SELECT coalesce(jsonb_agg(to_jsonb(oi) ORDER BY oi.created_at ASC NULLS LAST), '[]'::jsonb)
  INTO v_order_items
  FROM public.order_items oi
  WHERE coalesce(array_length(v_order_ids, 1), 0) > 0
    AND oi.order_id = ANY(v_order_ids);

  SELECT coalesce(jsonb_agg(to_jsonb(eol) ORDER BY eol.created_at ASC NULLS LAST), '[]'::jsonb)
  INTO v_equipment_order_lines
  FROM public.equipment_order_lines eol
  WHERE coalesce(array_length(v_order_ids, 1), 0) > 0
    AND eol.order_id = ANY(v_order_ids);

  SELECT coalesce(jsonb_agg(to_jsonb(pd) ORDER BY pd.created_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_payment_disputes
  FROM public.payment_disputes pd
  WHERE (coalesce(array_length(v_payment_ids, 1), 0) > 0 AND pd.payment_id = ANY(v_payment_ids))
     OR pd.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[]));

  SELECT coalesce(jsonb_agg(to_jsonb(ar) ORDER BY ar.created_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_activation_requests
  FROM public.activation_requests ar
  WHERE ar.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[]))
     OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND ar.order_id = ANY(v_order_ids));

  SELECT coalesce(jsonb_agg(to_jsonb(asl) ORDER BY asl.created_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_account_service_locations
  FROM public.account_service_locations asl
  WHERE coalesce(array_length(v_account_ids, 1), 0) > 0
    AND asl.account_id = ANY(v_account_ids);

  SELECT coalesce(jsonb_agg(to_jsonb(rrt) ORDER BY rrt.created_at DESC NULLS LAST), '[]'::jsonb),
         coalesce(array_agg(DISTINCT rrt.id), ARRAY[]::uuid[])
  INTO v_replacement_request_tickets, v_replacement_request_ticket_ids
  FROM public.replacement_request_tickets rrt
  WHERE rrt.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[]))
     OR (coalesce(array_length(v_account_ids, 1), 0) > 0 AND rrt.account_id = ANY(v_account_ids));

  SELECT coalesce(jsonb_agg(to_jsonb(rs) ORDER BY rs.created_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_replacement_shipments
  FROM public.replacement_shipments rs
  WHERE coalesce(array_length(v_replacement_request_ticket_ids, 1), 0) > 0
    AND rs.ticket_id = ANY(v_replacement_request_ticket_ids);

  SELECT coalesce(jsonb_agg(to_jsonb(rt) ORDER BY rt.created_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_replacement_timeline
  FROM public.replacement_timeline rt
  WHERE coalesce(array_length(v_replacement_request_ticket_ids, 1), 0) > 0
    AND rt.ticket_id = ANY(v_replacement_request_ticket_ids)
    AND coalesce(rt.visible_to_client, true) = true;

  SELECT coalesce(jsonb_agg(to_jsonb(rc) ORDER BY rc.created_at ASC NULLS LAST), '[]'::jsonb)
  INTO v_referral_codes
  FROM public.referral_codes rc
  WHERE rc.owner_user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[]));

  SELECT coalesce(jsonb_agg(to_jsonb(cr) ORDER BY cr.created_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_client_referrals
  FROM public.client_referrals cr
  WHERE cr.referrer_user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[]));

  SELECT coalesce(jsonb_agg(to_jsonb(lr) ORDER BY lr.points_required ASC NULLS LAST, lr.created_at ASC NULLS LAST), '[]'::jsonb)
  INTO v_loyalty_rewards
  FROM public.loyalty_rewards lr
  WHERE coalesce(lr.is_active, true) = true;

  SELECT coalesce(jsonb_agg(to_jsonb(paa) ORDER BY paa.started_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_paypal_autopay_attempts
  FROM public.paypal_autopay_attempts paa
  WHERE paa.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[]));

  RETURN v_snapshot || jsonb_build_object(
    'ticketReplies', v_ticket_replies,
    'webFormMessages', v_web_form_messages,
    'orderItems', v_order_items,
    'equipmentOrderLines', v_equipment_order_lines,
    'paymentDisputes', v_payment_disputes,
    'activationRequests', v_activation_requests,
    'accountServiceLocations', v_account_service_locations,
    'replacementRequestTickets', v_replacement_request_tickets,
    'replacementShipments', v_replacement_shipments,
    'replacementTimeline', v_replacement_timeline,
    'referralCodes', v_referral_codes,
    'clientReferrals', v_client_referrals,
    'loyaltyRewards', v_loyalty_rewards,
    'paypalAutopayAttempts', v_paypal_autopay_attempts
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_portal_core_domain_presence(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_snapshot jsonb;
  v_ids jsonb;
  v_related_user_ids uuid[] := ARRAY[_user_id]::uuid[];
  v_customer_ids uuid[] := ARRAY[]::uuid[];
  v_account_ids uuid[] := ARRAY[]::uuid[];
  v_order_ids uuid[] := ARRAY[]::uuid[];
  v_subscription_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  v_snapshot := public.customer_portal_enrich_snapshot(_user_id, public.get_client_history_snapshot(_user_id));
  v_ids := coalesce(v_snapshot->'identifiers', '{}'::jsonb);

  SELECT coalesce(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_related_user_ids FROM jsonb_array_elements_text(coalesce(v_ids->'relatedUserIds', jsonb_build_array(_user_id))) AS value WHERE value ~* '^[0-9a-f-]{36}$';
  SELECT coalesce(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_customer_ids FROM jsonb_array_elements_text(coalesce(v_ids->'customerIds', '[]'::jsonb)) AS value WHERE value ~* '^[0-9a-f-]{36}$';
  SELECT coalesce(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_account_ids FROM jsonb_array_elements_text(coalesce(v_ids->'accountIds', '[]'::jsonb)) AS value WHERE value ~* '^[0-9a-f-]{36}$';
  SELECT coalesce(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_order_ids FROM jsonb_array_elements_text(coalesce(v_ids->'orderIds', '[]'::jsonb)) AS value WHERE value ~* '^[0-9a-f-]{36}$';
  SELECT coalesce(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_subscription_ids FROM jsonb_array_elements_text(coalesce(v_ids->'subscriptionIds', '[]'::jsonb)) AS value WHERE value ~* '^[0-9a-f-]{36}$';

  RETURN jsonb_build_object(
    'profile', CASE WHEN coalesce(v_snapshot->'profile', 'null'::jsonb) <> 'null'::jsonb THEN 1 ELSE 0 END,
    'account', CASE WHEN coalesce(v_snapshot->'account', 'null'::jsonb) <> 'null'::jsonb THEN 1 ELSE 0 END,
    'services', public.customer_portal_snapshot_array_count(v_snapshot, 'subscriptions') + public.customer_portal_snapshot_array_count(v_snapshot, 'serviceInstances'),
    'orders', public.customer_portal_snapshot_array_count(v_snapshot, 'orders') + public.customer_portal_snapshot_array_count(v_snapshot, 'phoneOrders'),
    'invoices', public.customer_portal_snapshot_array_count(v_snapshot, 'invoices') + public.customer_portal_snapshot_array_count(v_snapshot, 'monthlyInvoices'),
    'payments', public.customer_portal_snapshot_array_count(v_snapshot, 'payments') + public.customer_portal_snapshot_array_count(v_snapshot, 'legacyPayments'),
    'contracts', public.customer_portal_snapshot_array_count(v_snapshot, 'contracts'),
    'equipment', public.customer_portal_snapshot_array_count(v_snapshot, 'equipment'),
    'tickets', public.customer_portal_snapshot_array_count(v_snapshot, 'supportTickets') + public.customer_portal_snapshot_array_count(v_snapshot, 'replacementTickets') + public.customer_portal_snapshot_array_count(v_snapshot, 'replacementRequestTickets'),
    'appointments', public.customer_portal_snapshot_array_count(v_snapshot, 'appointments'),
    'documents', public.customer_portal_snapshot_array_count(v_snapshot, 'autoDocuments') + public.customer_portal_snapshot_array_count(v_snapshot, 'clientDocuments') + public.customer_portal_snapshot_array_count(v_snapshot, 'orderDocuments') + public.customer_portal_snapshot_array_count(v_snapshot, 'paymentProofs') + public.customer_portal_snapshot_array_count(v_snapshot, 'documentRequests'),
    'notifications', public.customer_portal_snapshot_array_count(v_snapshot, 'notifications'),
    'activity', public.customer_portal_snapshot_array_count(v_snapshot, 'activity'),
    'ledger', public.customer_portal_snapshot_array_count(v_snapshot, 'payments') + public.customer_portal_snapshot_array_count(v_snapshot, 'legacyPayments') + public.customer_portal_snapshot_array_count(v_snapshot, 'invoices') + public.customer_portal_snapshot_array_count(v_snapshot, 'monthlyInvoices'),
    'referrals', public.customer_portal_snapshot_array_count(v_snapshot, 'referralCodes') + public.customer_portal_snapshot_array_count(v_snapshot, 'clientReferrals'),
    'loyalty', public.customer_portal_snapshot_array_count(v_snapshot, 'loyaltyPoints') + public.customer_portal_snapshot_array_count(v_snapshot, 'loyaltyTransactions') + public.customer_portal_snapshot_array_count(v_snapshot, 'loyaltyRewards'),
    'autopay', public.customer_portal_snapshot_array_count(v_snapshot, 'paypalAutopayAttempts'),
    'identifiers', jsonb_build_object('relatedUserIds', to_jsonb(coalesce(v_related_user_ids, ARRAY[]::uuid[])), 'customerIds', to_jsonb(coalesce(v_customer_ids, ARRAY[]::uuid[])), 'accountIds', to_jsonb(coalesce(v_account_ids, ARRAY[]::uuid[])), 'orderIds', to_jsonb(coalesce(v_order_ids, ARRAY[]::uuid[])), 'subscriptionIds', to_jsonb(coalesce(v_subscription_ids, ARRAY[]::uuid[])))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_customer_portal_snapshot(_user_id uuid, _snapshot jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_enriched jsonb := public.customer_portal_enrich_snapshot(_user_id, coalesce(_snapshot, '{}'::jsonb));
  v_counts jsonb := public.customer_portal_projection_domain_counts(v_enriched);
  v_core_counts jsonb := public.customer_portal_core_domain_presence(_user_id);
  v_errors jsonb := '[]'::jsonb;
  v_core_has_data boolean := false;
  v_portal_empty boolean := public.customer_portal_snapshot_domain_empty(v_counts);
  v_domain text;
  v_core_count integer;
  v_portal_count integer;
BEGIN
  FOREACH v_domain IN ARRAY ARRAY['services','orders','invoices','payments','contracts','equipment','tickets','appointments','documents','notifications','activity','ledger','referrals','loyalty','autopay'] LOOP
    v_core_count := coalesce((v_core_counts->>v_domain)::integer, 0);
    v_portal_count := coalesce((v_counts->>v_domain)::integer, 0);
    IF v_core_count > 0 THEN
      v_core_has_data := true;
      IF v_portal_count <= 0 THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('code', 'CORE_DOMAIN_MISSING_IN_PORTAL', 'severity', 'critical', 'domain', v_domain, 'coreCount', v_core_count, 'portalCount', v_portal_count, 'message', 'Core contient des données pour ce domaine mais le portail ne les projette pas.'));
      END IF;
    END IF;
  END LOOP;

  IF coalesce((v_core_counts->>'account')::integer, 0) > 0 OR coalesce((v_core_counts->>'profile')::integer, 0) > 0 THEN
    v_core_has_data := true;
  END IF;

  IF v_core_has_data AND v_portal_empty THEN
    v_errors := v_errors || jsonb_build_array(jsonb_build_object('code', 'PORTAL_EMPTY_CORE_POPULATED', 'severity', 'critical', 'message', 'Core contient des données client mais la projection portail ne contient aucune donnée métier.', 'sectionCounts', v_counts, 'coreCounts', v_core_counts));
  END IF;

  RETURN jsonb_build_object('status', CASE WHEN jsonb_array_length(v_errors) = 0 THEN 'valid' ELSE 'invalid' END, 'errors', v_errors, 'sectionCounts', v_counts, 'coreCounts', v_core_counts, 'coreHasData', v_core_has_data, 'portalEmpty', v_portal_empty);
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_portal_projection_domain_counts(_snapshot jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN jsonb_build_object(
    'services', public.customer_portal_snapshot_array_count(_snapshot, 'subscriptions') + public.customer_portal_snapshot_array_count(_snapshot, 'serviceInstances'),
    'orders', public.customer_portal_snapshot_array_count(_snapshot, 'orders') + public.customer_portal_snapshot_array_count(_snapshot, 'phoneOrders'),
    'invoices', public.customer_portal_snapshot_array_count(_snapshot, 'invoices') + public.customer_portal_snapshot_array_count(_snapshot, 'monthlyInvoices'),
    'payments', public.customer_portal_snapshot_array_count(_snapshot, 'payments') + public.customer_portal_snapshot_array_count(_snapshot, 'legacyPayments'),
    'contracts', public.customer_portal_snapshot_array_count(_snapshot, 'contracts'),
    'equipment', public.customer_portal_snapshot_array_count(_snapshot, 'equipment') + public.customer_portal_snapshot_array_count(_snapshot, 'equipmentOrderLines'),
    'tickets', public.customer_portal_snapshot_array_count(_snapshot, 'supportTickets') + public.customer_portal_snapshot_array_count(_snapshot, 'replacementTickets') + public.customer_portal_snapshot_array_count(_snapshot, 'replacementRequestTickets'),
    'appointments', public.customer_portal_snapshot_array_count(_snapshot, 'appointments'),
    'documents', public.customer_portal_snapshot_array_count(_snapshot, 'autoDocuments') + public.customer_portal_snapshot_array_count(_snapshot, 'clientDocuments') + public.customer_portal_snapshot_array_count(_snapshot, 'orderDocuments') + public.customer_portal_snapshot_array_count(_snapshot, 'paymentProofs') + public.customer_portal_snapshot_array_count(_snapshot, 'documentRequests'),
    'notifications', public.customer_portal_snapshot_array_count(_snapshot, 'notifications'),
    'activity', public.customer_portal_snapshot_array_count(_snapshot, 'activity'),
    'ledger', public.customer_portal_snapshot_array_count(_snapshot, 'payments') + public.customer_portal_snapshot_array_count(_snapshot, 'legacyPayments') + public.customer_portal_snapshot_array_count(_snapshot, 'invoices') + public.customer_portal_snapshot_array_count(_snapshot, 'monthlyInvoices'),
    'referrals', public.customer_portal_snapshot_array_count(_snapshot, 'referralCodes') + public.customer_portal_snapshot_array_count(_snapshot, 'clientReferrals'),
    'loyalty', public.customer_portal_snapshot_array_count(_snapshot, 'loyaltyPoints') + public.customer_portal_snapshot_array_count(_snapshot, 'loyaltyTransactions') + public.customer_portal_snapshot_array_count(_snapshot, 'loyaltyRewards'),
    'autopay', public.customer_portal_snapshot_array_count(_snapshot, 'paypalAutopayAttempts')
  );
END;
$$;

DO $$
DECLARE
  t text;
  is_table boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','accounts','billing_customers','orders','order_lifecycle','order_status_history','order_automation_log','billing_invoices','monthly_invoices','billing_payments','payments','contracts','client_auto_documents','client_documents','order_documents','payment_proofs','billing_subscriptions','billing_subscription_services','billing_subscription_trace_audit','service_instances','service_addresses','equipment_inventory','equipment_order_lines','equipment_audit_log','phone_orders','appointments','support_tickets','ticket_replies','ticket_attachments','replacement_tickets','replacement_orders','replacement_request_tickets','replacement_shipments','replacement_timeline','service_cancellation_requests','payment_methods','authorized_users','web_form_threads','web_form_messages','loyalty_points','loyalty_transactions','loyalty_rewards','referral_codes','client_referrals','paypal_autopay_attempts','client_autopay_settings','identity_verification_sessions','kyc_requested_documents','document_requests','notifications','channel_selections','payment_disputes','account_service_locations'
  ] LOOP
    SELECT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = t AND c.relkind IN ('r','p')) INTO is_table;
    IF is_table THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_customer_portal_projection_%I ON public.%I', t, t);
      EXECUTE format('CREATE TRIGGER trg_customer_portal_projection_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enqueue_customer_portal_projection_event()', t, t);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customer_portal_snapshots') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_portal_snapshots;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customer_portal_projection_events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_portal_projection_events;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customer_portal_projection_alerts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_portal_projection_alerts;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customer_portal_repair_jobs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_portal_repair_jobs;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customer_portal_projection_audit_logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_portal_projection_audit_logs;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.customer_portal_enrich_snapshot(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.customer_portal_enrich_snapshot(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_portal_enrich_snapshot(uuid, jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.customer_portal_core_domain_presence(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.customer_portal_core_domain_presence(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_portal_core_domain_presence(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.validate_customer_portal_snapshot(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.validate_customer_portal_snapshot(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_customer_portal_snapshot(uuid, jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.customer_portal_projection_domain_counts(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.customer_portal_projection_domain_counts(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_portal_projection_domain_counts(jsonb) TO service_role;