DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['field_payment_intents','field_quotes','field_sales_orders','card_payment_intents'] LOOP
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = t AND c.relkind IN ('r','p'))
       AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.enqueue_customer_portal_projection_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  r record;
  v_user_ids uuid[] := ARRAY[]::uuid[];
  v_customer_id uuid;
  v_account_id uuid;
  v_order_id uuid;
  v_subscription_id uuid;
  v_ticket_id uuid;
  v_quote_id uuid;
  v_row_id uuid;
  v_email text;
  v_uid uuid;
  v_event_id uuid;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  v_customer_id := nullif(to_jsonb(r)->>'customer_id', '')::uuid;
  v_account_id := nullif(to_jsonb(r)->>'account_id', '')::uuid;
  v_order_id := coalesce(nullif(to_jsonb(r)->>'order_id', '')::uuid, nullif(to_jsonb(r)->>'related_order_id', '')::uuid, nullif(to_jsonb(r)->>'original_order_id', '')::uuid, nullif(to_jsonb(r)->>'converted_order_id', '')::uuid);
  v_subscription_id := nullif(to_jsonb(r)->>'subscription_id', '')::uuid;
  v_ticket_id := coalesce(nullif(to_jsonb(r)->>'ticket_id', '')::uuid, nullif(to_jsonb(r)->>'support_ticket_id', '')::uuid);
  v_quote_id := nullif(to_jsonb(r)->>'quote_id', '')::uuid;
  v_row_id := nullif(to_jsonb(r)->>'id', '')::uuid;
  v_email := lower(btrim(coalesce(to_jsonb(r)->>'customer_email', to_jsonb(r)->>'client_email', to_jsonb(r)->>'email', to_jsonb(r)->>'to_email', to_jsonb(r)->'client_info'->>'email')));

  IF v_email IS NULL AND v_quote_id IS NOT NULL THEN
    SELECT lower(btrim(client_info->>'email')) INTO v_email
    FROM public.field_quotes
    WHERE id = v_quote_id
    LIMIT 1;
  END IF;

  SELECT array_remove(array_agg(DISTINCT user_id), NULL) INTO v_user_ids
  FROM (
    SELECT nullif(to_jsonb(r)->>'user_id', '')::uuid AS user_id
    UNION SELECT nullif(to_jsonb(r)->>'client_id', '')::uuid
    UNION SELECT nullif(to_jsonb(r)->>'owner_user_id', '')::uuid
    UNION SELECT nullif(to_jsonb(r)->>'created_by_user_id', '')::uuid
    UNION SELECT nullif(to_jsonb(r)->>'linked_user_id', '')::uuid
    UNION SELECT bc.user_id FROM public.billing_customers bc WHERE bc.id = v_customer_id
    UNION SELECT a.client_id FROM public.accounts a WHERE a.id = v_account_id
    UNION SELECT o.user_id FROM public.orders o WHERE o.id = v_order_id
    UNION SELECT a.client_id FROM public.accounts a JOIN public.orders o ON o.account_id = a.id WHERE o.id = v_order_id
    UNION SELECT bc.user_id FROM public.billing_customers bc JOIN public.billing_subscriptions bs ON bs.customer_id = bc.id WHERE bs.id = v_subscription_id
    UNION SELECT st.user_id FROM public.support_tickets st WHERE st.id = v_ticket_id
    UNION SELECT st.owner_user_id FROM public.support_tickets st WHERE st.id = v_ticket_id
    UNION SELECT p.user_id FROM public.profiles p WHERE v_email IS NOT NULL AND lower(btrim(p.email)) = v_email
    UNION SELECT bc.user_id FROM public.billing_customers bc WHERE v_email IS NOT NULL AND lower(btrim(bc.email)) = v_email
    UNION SELECT o.user_id FROM public.orders o WHERE v_email IS NOT NULL AND lower(btrim(o.client_email)) = v_email
  ) u;

  FOREACH v_uid IN ARRAY coalesce(v_user_ids, ARRAY[]::uuid[]) LOOP
    INSERT INTO public.customer_portal_projection_events (user_id, event_source, event_id, payload, status)
    VALUES (v_uid, TG_TABLE_NAME, v_row_id, jsonb_build_object('operation', TG_OP, 'table', TG_TABLE_NAME, 'email', v_email), 'processing')
    RETURNING id INTO v_event_id;

    BEGIN
      PERFORM public.refresh_customer_portal_snapshot_internal(v_uid, TG_TABLE_NAME, v_row_id);
      UPDATE public.customer_portal_projection_events SET status = 'processed', processed_at = now(), attempts = attempts + 1 WHERE id = v_event_id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.customer_portal_projection_events SET status = 'failed', attempts = attempts + 1, last_error = SQLERRM WHERE id = v_event_id;
      INSERT INTO public.customer_portal_projection_logs (user_id, event_source, event_id, status, message, details)
      VALUES (v_uid, TG_TABLE_NAME, v_row_id, 'error', SQLERRM, jsonb_build_object('operation', TG_OP, 'sqlstate', SQLSTATE));
      INSERT INTO public.customer_portal_projection_alerts (user_id, alert_type, severity, message, details)
      VALUES (v_uid, 'projection_rebuild_failed', 'critical', 'La reconstruction automatique du portail client a échoué.', jsonb_build_object('table', TG_TABLE_NAME, 'source_id', v_row_id, 'error', SQLERRM));
    END;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['field_payment_intents','field_quotes','field_sales_orders','card_payment_intents'] LOOP
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = t AND c.relkind IN ('r','p')) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_customer_portal_projection_%I ON public.%I', t, t);
      EXECUTE format('CREATE TRIGGER trg_customer_portal_projection_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enqueue_customer_portal_projection_event()', t, t);
    END IF;
  END LOOP;
END $$;

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
  v_emails text[] := ARRAY[]::text[];
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
  v_field_quotes jsonb := '[]'::jsonb;
  v_field_payment_intents jsonb := '[]'::jsonb;
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

  SELECT coalesce(array_agg(lower(btrim(value))), ARRAY[]::text[]) INTO v_emails
  FROM jsonb_array_elements_text(coalesce(v_ids->'emails', '[]'::jsonb)) AS value
  WHERE nullif(btrim(value), '') IS NOT NULL;

  SELECT coalesce(array_agg(DISTINCT (t->>'id')::uuid), ARRAY[]::uuid[]) INTO v_ticket_ids FROM jsonb_array_elements(coalesce(v_snapshot->'supportTickets', '[]'::jsonb)) AS t WHERE t ? 'id' AND (t->>'id') ~* '^[0-9a-f-]{36}$';
  SELECT coalesce(array_agg(DISTINCT (w->>'id')::uuid), ARRAY[]::uuid[]) INTO v_thread_ids FROM jsonb_array_elements(coalesce(v_snapshot->'webFormThreads', '[]'::jsonb)) AS w WHERE w ? 'id' AND (w->>'id') ~* '^[0-9a-f-]{36}$';
  SELECT coalesce(array_agg(DISTINCT (p->>'id')::uuid), ARRAY[]::uuid[]) INTO v_payment_ids FROM jsonb_array_elements(coalesce(v_snapshot->'payments', '[]'::jsonb) || coalesce(v_snapshot->'legacyPayments', '[]'::jsonb)) AS p WHERE p ? 'id' AND (p->>'id') ~* '^[0-9a-f-]{36}$';

  SELECT coalesce(jsonb_agg(to_jsonb(tr) ORDER BY tr.created_at ASC NULLS LAST), '[]'::jsonb) INTO v_ticket_replies FROM public.ticket_replies tr WHERE coalesce(array_length(v_ticket_ids, 1), 0) > 0 AND tr.ticket_id = ANY(v_ticket_ids);
  SELECT coalesce(jsonb_agg(to_jsonb(wfm) ORDER BY wfm.created_at ASC NULLS LAST), '[]'::jsonb) INTO v_web_form_messages FROM public.web_form_messages wfm WHERE coalesce(array_length(v_thread_ids, 1), 0) > 0 AND wfm.thread_id = ANY(v_thread_ids) AND coalesce(wfm.is_internal_note, false) = false;
  SELECT coalesce(jsonb_agg(to_jsonb(oi) ORDER BY oi.created_at ASC NULLS LAST), '[]'::jsonb) INTO v_order_items FROM public.order_items oi WHERE coalesce(array_length(v_order_ids, 1), 0) > 0 AND oi.order_id = ANY(v_order_ids);
  SELECT coalesce(jsonb_agg(to_jsonb(eol) ORDER BY eol.created_at ASC NULLS LAST), '[]'::jsonb) INTO v_equipment_order_lines FROM public.equipment_order_lines eol WHERE coalesce(array_length(v_order_ids, 1), 0) > 0 AND eol.order_id = ANY(v_order_ids);
  SELECT coalesce(jsonb_agg(to_jsonb(pd) ORDER BY pd.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_payment_disputes FROM public.payment_disputes pd WHERE (coalesce(array_length(v_payment_ids, 1), 0) > 0 AND pd.payment_id = ANY(v_payment_ids)) OR pd.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[]));
  SELECT coalesce(jsonb_agg(to_jsonb(ar) ORDER BY coalesce(ar.submitted_at, ar.updated_at, ar.activated_at, ar.completed_at) DESC NULLS LAST), '[]'::jsonb) INTO v_activation_requests FROM public.activation_requests ar WHERE ar.client_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND ar.order_id = ANY(v_order_ids));
  SELECT coalesce(jsonb_agg(to_jsonb(asl) ORDER BY asl.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_account_service_locations FROM public.account_service_locations asl WHERE coalesce(array_length(v_account_ids, 1), 0) > 0 AND asl.account_id = ANY(v_account_ids);
  SELECT coalesce(jsonb_agg(to_jsonb(rrt) ORDER BY rrt.created_at DESC NULLS LAST), '[]'::jsonb), coalesce(array_agg(DISTINCT rrt.id), ARRAY[]::uuid[]) INTO v_replacement_request_tickets, v_replacement_request_ticket_ids FROM public.replacement_request_tickets rrt WHERE rrt.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_account_ids, 1), 0) > 0 AND rrt.account_id = ANY(v_account_ids));
  SELECT coalesce(jsonb_agg(to_jsonb(rs) ORDER BY rs.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_replacement_shipments FROM public.replacement_shipments rs WHERE coalesce(array_length(v_replacement_request_ticket_ids, 1), 0) > 0 AND rs.ticket_id = ANY(v_replacement_request_ticket_ids);
  SELECT coalesce(jsonb_agg(to_jsonb(rt) ORDER BY rt.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_replacement_timeline FROM public.replacement_timeline rt WHERE coalesce(array_length(v_replacement_request_ticket_ids, 1), 0) > 0 AND rt.ticket_id = ANY(v_replacement_request_ticket_ids) AND coalesce(rt.visible_to_client, true) = true;
  SELECT coalesce(jsonb_agg(to_jsonb(rc) ORDER BY rc.created_at ASC NULLS LAST), '[]'::jsonb) INTO v_referral_codes FROM public.referral_codes rc WHERE rc.owner_user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[]));
  SELECT coalesce(jsonb_agg(to_jsonb(cr) ORDER BY cr.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_client_referrals FROM public.client_referrals cr WHERE cr.referrer_user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[]));
  SELECT coalesce(jsonb_agg(to_jsonb(lr) ORDER BY lr.points_required ASC NULLS LAST, lr.created_at ASC NULLS LAST), '[]'::jsonb) INTO v_loyalty_rewards FROM public.loyalty_rewards lr WHERE coalesce(lr.is_active, true) = true;
  SELECT coalesce(jsonb_agg(to_jsonb(paa) ORDER BY paa.started_at DESC NULLS LAST), '[]'::jsonb) INTO v_paypal_autopay_attempts FROM public.paypal_autopay_attempts paa WHERE paa.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[]));

  SELECT coalesce(jsonb_agg(to_jsonb(fq) ORDER BY fq.created_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_field_quotes
  FROM public.field_quotes fq
  WHERE coalesce(array_length(v_emails, 1), 0) > 0
    AND lower(btrim(fq.client_info->>'email')) = ANY(v_emails);

  SELECT coalesce(jsonb_agg(to_jsonb(fpi) || jsonb_build_object('field_quote', coalesce((SELECT to_jsonb(fq) FROM public.field_quotes fq WHERE fq.id = fpi.quote_id LIMIT 1), 'null'::jsonb)) ORDER BY fpi.created_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_field_payment_intents
  FROM public.field_payment_intents fpi
  WHERE (coalesce(array_length(v_emails, 1), 0) > 0 AND lower(btrim(fpi.customer_email)) = ANY(v_emails))
     OR EXISTS (SELECT 1 FROM public.field_quotes fq WHERE fq.id = fpi.quote_id AND coalesce(array_length(v_emails, 1), 0) > 0 AND lower(btrim(fq.client_info->>'email')) = ANY(v_emails));

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
    'paypalAutopayAttempts', v_paypal_autopay_attempts,
    'fieldQuotes', v_field_quotes,
    'fieldPaymentIntents', v_field_payment_intents
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.customer_portal_enrich_snapshot(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.customer_portal_enrich_snapshot(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_portal_enrich_snapshot(uuid, jsonb) TO service_role;