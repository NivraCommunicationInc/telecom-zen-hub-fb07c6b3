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
  v_thread_ids uuid[] := ARRAY[]::uuid[];
  v_payment_ids uuid[] := ARRAY[]::uuid[];
  v_ticket_replies jsonb := '[]'::jsonb;
  v_web_form_messages jsonb := '[]'::jsonb;
  v_order_items jsonb := '[]'::jsonb;
  v_equipment_order_lines jsonb := '[]'::jsonb;
  v_payment_disputes jsonb := '[]'::jsonb;
  v_activation_requests jsonb := '[]'::jsonb;
  v_account_service_locations jsonb := '[]'::jsonb;
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

  RETURN v_snapshot || jsonb_build_object(
    'ticketReplies', v_ticket_replies,
    'webFormMessages', v_web_form_messages,
    'orderItems', v_order_items,
    'equipmentOrderLines', v_equipment_order_lines,
    'paymentDisputes', v_payment_disputes,
    'activationRequests', v_activation_requests,
    'accountServiceLocations', v_account_service_locations
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_customer_portal_snapshot(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_cached public.customer_portal_snapshots%ROWTYPE;
  v_is_stale boolean := false;
  v_snapshot jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;
  IF auth.uid() <> _user_id AND NOT public.is_portal_projection_staff(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé'; END IF;

  SELECT * INTO v_cached FROM public.customer_portal_snapshots WHERE user_id = _user_id;
  v_is_stale := NOT FOUND OR v_cached.last_refreshed_at < now() - interval '15 seconds' OR v_cached.validation_status <> 'valid' OR (v_cached.core_has_data = true AND v_cached.portal_empty = true);

  IF v_is_stale THEN
    v_snapshot := public.refresh_customer_portal_snapshot_internal(_user_id, 'read_hydration_repair', NULL);
    RETURN public.customer_portal_enrich_snapshot(_user_id, v_snapshot);
  END IF;

  v_snapshot := v_cached.snapshot || jsonb_build_object('projection', jsonb_build_object('source', 'customer_portal_snapshot', 'version', v_cached.projection_version, 'lastRefreshedAt', v_cached.last_refreshed_at, 'sectionCounts', v_cached.section_counts, 'validationStatus', v_cached.validation_status, 'validationErrors', v_cached.validation_errors, 'coreHasData', v_cached.core_has_data, 'portalEmpty', v_cached.portal_empty, 'stale', false));
  RETURN public.customer_portal_enrich_snapshot(_user_id, v_snapshot);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.customer_portal_enrich_snapshot(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.customer_portal_enrich_snapshot(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_portal_enrich_snapshot(uuid, jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_customer_portal_snapshot(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_customer_portal_snapshot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_portal_snapshot(uuid) TO service_role;