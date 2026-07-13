CREATE OR REPLACE FUNCTION public.fn_upsert_canonical_appointment_from_legacy(
  _source text,
  _source_id uuid,
  _order_id uuid DEFAULT NULL,
  _client_id uuid DEFAULT NULL,
  _account_id uuid DEFAULT NULL,
  _service_address_id uuid DEFAULT NULL,
  _technician_id uuid DEFAULT NULL,
  _scheduled_at timestamptz DEFAULT NULL,
  _status text DEFAULT NULL,
  _service_address text DEFAULT NULL,
  _service_city text DEFAULT NULL,
  _service_postal_code text DEFAULT NULL,
  _client_email text DEFAULT NULL,
  _client_phone text DEFAULT NULL,
  _service_type text DEFAULT NULL,
  _title text DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing uuid;
  v_addr uuid;
  v_order_account_id uuid;
  v_order_user_id uuid;
  v_order_client_email text;
  v_order_client_phone text;
  v_order_number text;
  v_order_addr text;
  v_order_city text;
  v_order_postal text;
  v_order_service_address_id uuid;
  v_order_service_type text;
  v_status text := lower(coalesce(nullif(_status, ''), 'scheduled'));
  v_notes text;
  v_title text;
BEGIN
  IF _scheduled_at IS NULL AND _technician_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_status IN ('pending', 'booked') THEN v_status := 'scheduled'; END IF;
  IF v_status IN ('done', 'complete') THEN v_status := 'completed'; END IF;

  IF _order_id IS NULL AND v_status IN ('confirmed', 'technician_assigned') THEN
    v_status := 'scheduled';
  END IF;

  IF _order_id IS NOT NULL THEN
    SELECT o.account_id, o.user_id, o.client_email, o.client_phone, o.order_number,
           coalesce(o.service_address, o.shipping_address, o.client_full_address),
           coalesce(o.service_city, o.shipping_city),
           coalesce(o.service_postal_code, o.shipping_postal_code),
           o.service_address_id,
           o.service_type
    INTO v_order_account_id, v_order_user_id, v_order_client_email, v_order_client_phone, v_order_number,
         v_order_addr, v_order_city, v_order_postal, v_order_service_address_id, v_order_service_type
    FROM public.orders o
    WHERE o.id = _order_id
    LIMIT 1;
  END IF;

  v_addr := coalesce(
    _service_address_id,
    public.fn_resolve_service_address_for_links(
      coalesce(_account_id, v_order_account_id),
      _order_id,
      coalesce(_client_id, v_order_user_id),
      coalesce(nullif(_service_address, ''), v_order_addr),
      coalesce(nullif(_service_city, ''), v_order_city),
      coalesce(nullif(_service_postal_code, ''), v_order_postal)
    )
  );

  SELECT ap.id INTO v_existing
  FROM public.appointments ap
  WHERE (_order_id IS NOT NULL AND ap.order_id = _order_id)
     OR ap.internal_notes ILIKE ('%legacy_source=' || _source || ':' || _source_id::text || '%')
  ORDER BY CASE WHEN ap.internal_notes ILIKE ('%legacy_source=' || _source || ':' || _source_id::text || '%') THEN 0 ELSE 1 END,
           ap.updated_at DESC NULLS LAST,
           ap.created_at DESC NULLS LAST
  LIMIT 1;

  v_notes := concat_ws(E'\n', nullif(_notes, ''), 'legacy_source=' || _source || ':' || _source_id::text);
  v_title := coalesce(nullif(_title, ''), CASE WHEN v_order_number IS NOT NULL THEN 'Installation — ' || v_order_number ELSE 'Installation' END);

  IF v_existing IS NOT NULL THEN
    UPDATE public.appointments ap SET
      order_id = coalesce(ap.order_id, _order_id),
      client_id = coalesce(ap.client_id, _client_id, v_order_user_id),
      client_email = coalesce(nullif(ap.client_email, ''), nullif(_client_email, ''), v_order_client_email),
      client_phone = coalesce(nullif(ap.client_phone, ''), nullif(_client_phone, ''), v_order_client_phone),
      technician_id = coalesce(_technician_id, ap.technician_id),
      scheduled_at = coalesce(_scheduled_at, ap.scheduled_at),
      status = CASE WHEN coalesce(ap.order_id, _order_id) IS NULL AND v_status IN ('confirmed', 'technician_assigned') THEN 'scheduled' ELSE coalesce(nullif(v_status, ''), ap.status, 'scheduled') END,
      service_type = coalesce(nullif(_service_type, ''), ap.service_type, v_order_service_type, 'installation'),
      installation_method = coalesce(ap.installation_method, 'technician'),
      service_address_id = coalesce(ap.service_address_id, v_addr, v_order_service_address_id),
      service_address = coalesce(nullif(ap.service_address, ''), nullif(_service_address, ''), v_order_addr),
      service_city = coalesce(nullif(ap.service_city, ''), nullif(_service_city, ''), v_order_city),
      service_postal_code = coalesce(nullif(ap.service_postal_code, ''), nullif(_service_postal_code, ''), v_order_postal),
      title = coalesce(nullif(ap.title, ''), v_title),
      internal_notes = CASE WHEN ap.internal_notes ILIKE ('%legacy_source=' || _source || ':' || _source_id::text || '%') THEN ap.internal_notes ELSE concat_ws(E'\n', ap.internal_notes, v_notes) END,
      environment = 'live',
      updated_at = now()
    WHERE ap.id = v_existing;
    RETURN v_existing;
  END IF;

  INSERT INTO public.appointments (
    order_id, client_id, client_email, client_phone, technician_id, scheduled_at, status,
    service_type, installation_method, service_address_id, service_address, service_city,
    service_postal_code, title, internal_notes, environment
  ) VALUES (
    _order_id,
    coalesce(_client_id, v_order_user_id),
    coalesce(nullif(_client_email, ''), v_order_client_email),
    coalesce(nullif(_client_phone, ''), v_order_client_phone),
    _technician_id,
    _scheduled_at,
    coalesce(nullif(v_status, ''), 'scheduled'),
    coalesce(nullif(_service_type, ''), v_order_service_type, 'installation'),
    'technician',
    coalesce(v_addr, v_order_service_address_id),
    coalesce(nullif(_service_address, ''), v_order_addr),
    coalesce(nullif(_service_city, ''), v_order_city),
    coalesce(nullif(_service_postal_code, ''), v_order_postal),
    v_title,
    v_notes,
    'live'
  ) RETURNING id INTO v_existing;

  RETURN v_existing;
END;
$$;

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
  v_live_appointments jsonb := '[]'::jsonb;
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

  SELECT coalesce(jsonb_agg(to_jsonb(ap) ORDER BY ap.scheduled_at DESC NULLS LAST, ap.created_at DESC), '[]'::jsonb)
  INTO v_live_appointments
  FROM public.appointments ap
  WHERE coalesce(ap.environment, 'live') = 'live'
    AND (
      ap.client_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[]))
      OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND ap.order_id = ANY(v_order_ids))
      OR (coalesce(array_length(v_emails, 1), 0) > 0 AND lower(btrim(ap.client_email)) = ANY(v_emails))
    );

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
    'appointments', (
      SELECT coalesce(jsonb_agg(item ORDER BY coalesce(item->>'scheduled_at', item->>'created_at') DESC NULLS LAST), '[]'::jsonb)
      FROM (
        SELECT DISTINCT ON (item->>'id') item
        FROM jsonb_array_elements(coalesce(v_snapshot->'appointments', '[]'::jsonb) || v_live_appointments) AS item
        WHERE item ? 'id'
        ORDER BY item->>'id', CASE WHEN item ? 'environment' THEN 0 ELSE 1 END
      ) d
    ),
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