CREATE OR REPLACE FUNCTION public.get_client_history_snapshot(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_has_profile boolean := false;
  v_account jsonb := 'null'::jsonb;
  v_billing_customer jsonb := 'null'::jsonb;
  v_orders jsonb := '[]'::jsonb;
  v_order_lifecycle jsonb := '[]'::jsonb;
  v_invoices jsonb := '[]'::jsonb;
  v_monthly_invoices jsonb := '[]'::jsonb;
  v_payments jsonb := '[]'::jsonb;
  v_legacy_payments jsonb := '[]'::jsonb;
  v_contracts jsonb := '[]'::jsonb;
  v_auto_documents jsonb := '[]'::jsonb;
  v_client_documents jsonb := '[]'::jsonb;
  v_order_documents jsonb := '[]'::jsonb;
  v_payment_proofs jsonb := '[]'::jsonb;
  v_subscriptions jsonb := '[]'::jsonb;
  v_service_instances jsonb := '[]'::jsonb;
  v_service_addresses jsonb := '[]'::jsonb;
  v_equipment jsonb := '[]'::jsonb;
  v_phone_orders jsonb := '[]'::jsonb;
  v_appointments jsonb := '[]'::jsonb;
  v_support_tickets jsonb := '[]'::jsonb;
  v_replacement_tickets jsonb := '[]'::jsonb;
  v_replacement_orders jsonb := '[]'::jsonb;
  v_cancellation_requests jsonb := '[]'::jsonb;
  v_payment_methods jsonb := '[]'::jsonb;
  v_authorized_contacts jsonb := '[]'::jsonb;
  v_web_form_threads jsonb := '[]'::jsonb;
  v_loyalty_points jsonb := '[]'::jsonb;
  v_loyalty_transactions jsonb := '[]'::jsonb;
  v_identity_verifications jsonb := '[]'::jsonb;
  v_document_requests jsonb := '[]'::jsonb;
  v_activity jsonb := '[]'::jsonb;
  v_customer_ids uuid[] := ARRAY[]::uuid[];
  v_order_ids uuid[] := ARRAY[]::uuid[];
  v_account_ids uuid[] := ARRAY[]::uuid[];
  v_subscription_ids uuid[] := ARRAY[]::uuid[];
  v_equipment_ids uuid[] := ARRAY[]::uuid[];
  v_related_user_ids uuid[] := ARRAY[_user_id]::uuid[];
  v_emails text[] := ARRAY[]::text[];
  v_auth_email text := NULL;
  v_used_email_fallback boolean := false;
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() <> _user_id
     AND NOT public.is_portal_projection_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT lower(btrim(u.email))
  INTO v_auth_email
  FROM auth.users u
  WHERE u.id = _user_id
    AND nullif(btrim(u.email), '') IS NOT NULL
  LIMIT 1;

  IF v_auth_email IS NOT NULL THEN
    v_emails := array_append(v_emails, v_auth_email);
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = _user_id
     OR p.id = _user_id
     OR (v_auth_email IS NOT NULL AND lower(btrim(p.email)) = v_auth_email)
  ORDER BY CASE WHEN p.user_id = _user_id THEN 0 WHEN p.id = _user_id THEN 1 ELSE 2 END,
           p.updated_at DESC NULLS LAST,
           p.created_at DESC NULLS LAST
  LIMIT 1;
  v_has_profile := FOUND;

  IF v_has_profile THEN
    SELECT array_remove(array_agg(DISTINCT user_id), NULL)
    INTO v_related_user_ids
    FROM (
      SELECT _user_id AS user_id
      UNION SELECT v_profile.id
      UNION SELECT v_profile.user_id
    ) u;
  END IF;

  SELECT array_remove(array_agg(DISTINCT email), NULL)
  INTO v_emails
  FROM (
    SELECT unnest(coalesce(v_emails, ARRAY[]::text[])) AS email
    UNION SELECT lower(btrim(v_profile.email)) WHERE v_has_profile AND nullif(btrim(v_profile.email), '') IS NOT NULL
    UNION SELECT lower(btrim(v_profile.pending_email)) WHERE v_has_profile AND nullif(btrim(v_profile.pending_email), '') IS NOT NULL
    UNION SELECT lower(btrim(v_profile.interac_email)) WHERE v_has_profile AND nullif(btrim(v_profile.interac_email), '') IS NOT NULL
    UNION SELECT lower(btrim(v_profile.professional_email)) WHERE v_has_profile AND nullif(btrim(v_profile.professional_email), '') IS NOT NULL
    UNION SELECT lower(btrim(bc.email)) FROM public.billing_customers bc WHERE bc.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) AND nullif(btrim(bc.email), '') IS NOT NULL
    UNION SELECT lower(btrim(o.client_email)) FROM public.orders o WHERE o.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) AND nullif(btrim(o.client_email), '') IS NOT NULL
    UNION SELECT lower(btrim(st.client_email)) FROM public.support_tickets st WHERE (st.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR st.owner_user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[]))) AND nullif(btrim(st.client_email), '') IS NOT NULL
    UNION SELECT lower(btrim(a.client_email)) FROM public.appointments a WHERE a.client_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) AND nullif(btrim(a.client_email), '') IS NOT NULL
  ) e;

  SELECT array_remove(array_agg(DISTINCT bc.id), NULL)
  INTO v_customer_ids
  FROM public.billing_customers bc
  WHERE bc.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[]))
     OR (coalesce(array_length(v_emails, 1), 0) > 0 AND lower(btrim(bc.email)) = ANY(v_emails));

  IF EXISTS (SELECT 1 FROM public.billing_customers bc WHERE coalesce(array_length(v_emails, 1), 0) > 0 AND lower(btrim(bc.email)) = ANY(v_emails) AND (bc.user_id IS NULL OR NOT (bc.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[]))))) THEN
    v_used_email_fallback := true;
  END IF;

  SELECT array_remove(array_agg(DISTINCT a.id), NULL)
  INTO v_account_ids
  FROM public.accounts a
  WHERE a.client_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[]))
     OR (coalesce(array_length(v_customer_ids, 1), 0) > 0 AND a.client_id = ANY(v_customer_ids))
     OR (v_has_profile AND nullif(btrim(v_profile.account_number), '') IS NOT NULL AND a.account_number = v_profile.account_number);

  SELECT array_remove(array_agg(DISTINCT o.id), NULL)
  INTO v_order_ids
  FROM public.orders o
  WHERE o.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[]))
     OR (coalesce(array_length(v_account_ids, 1), 0) > 0 AND o.account_id = ANY(v_account_ids))
     OR (coalesce(array_length(v_emails, 1), 0) > 0 AND lower(btrim(o.client_email)) = ANY(v_emails))
     OR (coalesce(array_length(v_customer_ids, 1), 0) > 0 AND EXISTS (SELECT 1 FROM public.billing_invoices bi WHERE bi.order_id = o.id AND bi.customer_id = ANY(v_customer_ids)))
     OR (coalesce(array_length(v_customer_ids, 1), 0) > 0 AND EXISTS (SELECT 1 FROM public.billing_subscriptions bs WHERE bs.order_id = o.id AND bs.customer_id = ANY(v_customer_ids)))
     OR EXISTS (SELECT 1 FROM public.payments lp WHERE lp.order_id = o.id AND (lp.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR lp.client_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_account_ids, 1), 0) > 0 AND lp.account_id = ANY(v_account_ids))))
     OR EXISTS (SELECT 1 FROM public.phone_orders po WHERE po.order_id = o.id AND (po.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_account_ids, 1), 0) > 0 AND po.account_id = ANY(v_account_ids))))
     OR EXISTS (SELECT 1 FROM public.appointments ap WHERE ap.order_id = o.id AND (ap.client_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_emails, 1), 0) > 0 AND lower(btrim(ap.client_email)) = ANY(v_emails))))
     OR EXISTS (SELECT 1 FROM public.support_tickets st WHERE st.related_order_id = o.id AND (st.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR st.owner_user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_emails, 1), 0) > 0 AND lower(btrim(st.client_email)) = ANY(v_emails))));

  IF EXISTS (SELECT 1 FROM public.orders o WHERE coalesce(array_length(v_emails, 1), 0) > 0 AND lower(btrim(o.client_email)) = ANY(v_emails) AND (o.user_id IS NULL OR NOT (o.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[]))))) THEN
    v_used_email_fallback := true;
  END IF;

  SELECT array_remove(array_agg(DISTINCT user_id), NULL)
  INTO v_related_user_ids
  FROM (
    SELECT unnest(coalesce(v_related_user_ids, ARRAY[]::uuid[])) AS user_id
    UNION SELECT o.user_id FROM public.orders o WHERE coalesce(array_length(v_order_ids, 1), 0) > 0 AND o.id = ANY(v_order_ids) AND o.user_id IS NOT NULL
  ) u;

  SELECT array_remove(array_agg(DISTINCT account_id), NULL)
  INTO v_account_ids
  FROM (
    SELECT unnest(coalesce(v_account_ids, ARRAY[]::uuid[])) AS account_id
    UNION SELECT o.account_id FROM public.orders o WHERE coalesce(array_length(v_order_ids, 1), 0) > 0 AND o.id = ANY(v_order_ids) AND o.account_id IS NOT NULL
    UNION SELECT si.account_id FROM public.service_instances si WHERE (si.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND si.order_id = ANY(v_order_ids))) AND si.account_id IS NOT NULL
    UNION SELECT po.account_id FROM public.phone_orders po WHERE (po.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND po.order_id = ANY(v_order_ids))) AND po.account_id IS NOT NULL
    UNION SELECT scr.account_id FROM public.service_cancellation_requests scr WHERE scr.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) AND scr.account_id IS NOT NULL
    UNION SELECT rrt.account_id FROM public.replacement_request_tickets rrt WHERE rrt.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) AND rrt.account_id IS NOT NULL
  ) resolved_accounts;

  SELECT COALESCE(to_jsonb(a), 'null'::jsonb) INTO v_account FROM (SELECT * FROM public.accounts WHERE id = ANY(coalesce(v_account_ids, ARRAY[]::uuid[])) ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, created_at DESC LIMIT 1) a;
  IF coalesce(array_length(v_customer_ids, 1), 0) > 0 THEN SELECT to_jsonb(bc) INTO v_billing_customer FROM public.billing_customers bc WHERE bc.id = ANY(v_customer_ids) ORDER BY CASE WHEN bc.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) THEN 0 ELSE 1 END, bc.created_at DESC NULLS LAST, bc.updated_at DESC NULLS LAST LIMIT 1; END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_orders FROM (SELECT DISTINCT ON (o.id) o.* FROM public.orders o WHERE coalesce(array_length(v_order_ids, 1), 0) > 0 AND o.id = ANY(v_order_ids) ORDER BY o.id, o.created_at DESC NULLS LAST) src;
  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.order_created_at DESC NULLS LAST), '[]'::jsonb) INTO v_order_lifecycle FROM (SELECT DISTINCT ON (ol.order_id) ol.* FROM public.order_lifecycle ol WHERE coalesce(array_length(v_order_ids, 1), 0) > 0 AND ol.order_id = ANY(v_order_ids) ORDER BY ol.order_id, ol.order_created_at DESC NULLS LAST) src;
  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_invoices FROM (SELECT DISTINCT ON (bi.id) bi.* FROM public.billing_invoices bi WHERE (coalesce(array_length(v_customer_ids, 1), 0) > 0 AND bi.customer_id = ANY(v_customer_ids)) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND bi.order_id = ANY(v_order_ids)) ORDER BY bi.id, bi.created_at DESC NULLS LAST) src;
  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_monthly_invoices FROM (SELECT DISTINCT ON (mi.id) mi.* FROM public.monthly_invoices mi WHERE mi.client_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) ORDER BY mi.id, mi.created_at DESC NULLS LAST) src;
  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_payments FROM (SELECT DISTINCT ON (bp.id) bp.* FROM public.billing_payments bp WHERE (coalesce(array_length(v_customer_ids, 1), 0) > 0 AND bp.customer_id = ANY(v_customer_ids)) OR EXISTS (SELECT 1 FROM public.billing_invoices bi WHERE bi.id = bp.invoice_id AND ((coalesce(array_length(v_customer_ids, 1), 0) > 0 AND bi.customer_id = ANY(v_customer_ids)) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND bi.order_id = ANY(v_order_ids)))) ORDER BY bp.id, bp.created_at DESC NULLS LAST) src;
  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_legacy_payments FROM (SELECT DISTINCT ON (p.id) p.* FROM public.payments p WHERE p.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR p.client_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_account_ids, 1), 0) > 0 AND p.account_id = ANY(v_account_ids)) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND p.order_id = ANY(v_order_ids)) ORDER BY p.id, p.created_at DESC NULLS LAST) src;
  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_contracts FROM (SELECT DISTINCT ON (c.id) c.* FROM public.contracts c WHERE c.owner_user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR c.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND c.order_id = ANY(v_order_ids)) ORDER BY c.id, c.created_at DESC NULLS LAST) src;
  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_auto_documents FROM (SELECT DISTINCT ON (d.id) d.* FROM public.client_auto_documents d WHERE d.client_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_account_ids, 1), 0) > 0 AND d.account_id = ANY(v_account_ids)) OR (coalesce(array_length(v_emails, 1), 0) > 0 AND lower(btrim(d.recipient_email)) = ANY(v_emails)) ORDER BY d.id, d.created_at DESC NULLS LAST) src;
  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_client_documents FROM (SELECT DISTINCT ON (d.id) d.* FROM public.client_documents d WHERE d.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) ORDER BY d.id, d.created_at DESC NULLS LAST) src;
  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_order_documents FROM (SELECT DISTINCT ON (d.id) d.* FROM public.order_documents d WHERE coalesce(array_length(v_order_ids, 1), 0) > 0 AND d.order_id = ANY(v_order_ids) ORDER BY d.id, d.created_at DESC NULLS LAST) src;
  SELECT array_remove(array_agg(DISTINCT s.id), NULL) INTO v_subscription_ids FROM public.billing_subscriptions s WHERE (coalesce(array_length(v_customer_ids, 1), 0) > 0 AND s.customer_id = ANY(v_customer_ids)) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND s.order_id = ANY(v_order_ids));
  SELECT coalesce(jsonb_agg(to_jsonb(src) || jsonb_build_object('billing_subscription_services', coalesce((SELECT jsonb_agg(to_jsonb(bss) ORDER BY bss.created_at ASC NULLS LAST) FROM public.billing_subscription_services bss WHERE bss.subscription_id = src.id), '[]'::jsonb), 'service_addresses', coalesce((SELECT to_jsonb(sa) FROM public.service_addresses sa WHERE sa.id = src.address_id LIMIT 1), (SELECT jsonb_build_object('id', NULL, 'account_id', a.id, 'label', coalesce(a.primary_service_city, a.billing_city, 'Adresse de service'), 'address_line', coalesce(a.primary_service_address, a.billing_address), 'city', coalesce(a.primary_service_city, a.billing_city), 'province', coalesce(a.primary_service_province, a.billing_province), 'postal_code', coalesce(a.primary_service_postal_code, a.billing_postal_code), 'is_primary', true) FROM public.accounts a LEFT JOIN public.orders o ON o.id = src.order_id WHERE a.id = o.account_id OR a.id = ANY(coalesce(v_account_ids, ARRAY[]::uuid[])) ORDER BY CASE WHEN a.id = o.account_id THEN 0 ELSE 1 END, a.created_at DESC NULLS LAST LIMIT 1), 'null'::jsonb)) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_subscriptions FROM (SELECT DISTINCT ON (s.id) s.* FROM public.billing_subscriptions s WHERE coalesce(array_length(v_subscription_ids, 1), 0) > 0 AND s.id = ANY(v_subscription_ids) ORDER BY s.id, s.created_at DESC NULLS LAST) src;
  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_service_instances FROM (SELECT DISTINCT ON (si.id) si.* FROM public.service_instances si WHERE si.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_account_ids, 1), 0) > 0 AND si.account_id = ANY(v_account_ids)) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND si.order_id = ANY(v_order_ids)) OR (coalesce(array_length(v_subscription_ids, 1), 0) > 0 AND si.metadata->>'subscription_id' = ANY(v_subscription_ids::text[])) ORDER BY si.id, si.created_at DESC NULLS LAST) src;
  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.is_primary DESC NULLS LAST, src.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_service_addresses FROM (SELECT DISTINCT ON (sa.id) sa.* FROM public.service_addresses sa WHERE coalesce(array_length(v_account_ids, 1), 0) > 0 AND sa.account_id = ANY(v_account_ids) ORDER BY sa.id, sa.is_primary DESC NULLS LAST, sa.created_at DESC NULLS LAST) src;
  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY COALESCE(src.deployed_at, src.assigned_at, src.created_at) DESC NULLS LAST), '[]'::jsonb) INTO v_equipment FROM (SELECT DISTINCT ON (ei.id) ei.* FROM public.equipment_inventory ei WHERE (coalesce(array_length(v_account_ids, 1), 0) > 0 AND ei.account_id = ANY(v_account_ids)) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND ei.order_id = ANY(v_order_ids)) OR (coalesce(array_length(v_subscription_ids, 1), 0) > 0 AND ei.subscription_id = ANY(v_subscription_ids)) ORDER BY ei.id, COALESCE(ei.deployed_at, ei.assigned_at, ei.created_at) DESC NULLS LAST) src;
  SELECT array_remove(array_agg(DISTINCT (e->>'id')::uuid), NULL) INTO v_equipment_ids FROM jsonb_array_elements(v_equipment) e WHERE e ? 'id';
  SELECT coalesce(jsonb_agg(to_jsonb(src) || jsonb_build_object('phone_inventory', coalesce((SELECT to_jsonb(pi) FROM public.phone_inventory pi WHERE pi.id = src.phone_inventory_id LIMIT 1), 'null'::jsonb), 'orders', coalesce((SELECT to_jsonb(o) FROM public.orders o WHERE o.id = src.order_id LIMIT 1), 'null'::jsonb)) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_phone_orders FROM (SELECT DISTINCT ON (po.id) po.* FROM public.phone_orders po WHERE po.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_account_ids, 1), 0) > 0 AND po.account_id = ANY(v_account_ids)) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND po.order_id = ANY(v_order_ids)) ORDER BY po.id, po.created_at DESC NULLS LAST) src;
  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_payment_proofs FROM (SELECT DISTINCT ON (pp.id) pp.* FROM public.payment_proofs pp WHERE pp.client_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR EXISTS (SELECT 1 FROM public.billing_payments bp WHERE bp.id = pp.payment_id AND ((coalesce(array_length(v_customer_ids, 1), 0) > 0 AND bp.customer_id = ANY(v_customer_ids)) OR EXISTS (SELECT 1 FROM public.billing_invoices bi WHERE bi.id = bp.invoice_id AND ((coalesce(array_length(v_customer_ids, 1), 0) > 0 AND bi.customer_id = ANY(v_customer_ids)) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND bi.order_id = ANY(v_order_ids)))))) ORDER BY pp.id, pp.created_at DESC NULLS LAST) src;
  SELECT coalesce(jsonb_agg(to_jsonb(src) || jsonb_build_object('technician', coalesce((SELECT to_jsonb(t) FROM public.technicians t WHERE t.id = src.technician_id LIMIT 1), 'null'::jsonb)) ORDER BY src.scheduled_at DESC NULLS LAST), '[]'::jsonb) INTO v_appointments FROM (SELECT DISTINCT ON (ap.id) ap.* FROM public.appointments ap WHERE ap.client_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND ap.order_id = ANY(v_order_ids)) OR (coalesce(array_length(v_emails, 1), 0) > 0 AND lower(btrim(ap.client_email)) = ANY(v_emails)) ORDER BY ap.id, ap.scheduled_at DESC NULLS LAST) src;
  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_support_tickets FROM (SELECT DISTINCT ON (st.id) st.* FROM public.support_tickets st WHERE st.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR st.owner_user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR st.created_by_user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_account_ids, 1), 0) > 0 AND st.account_id = ANY(v_account_ids)) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND st.related_order_id = ANY(v_order_ids)) OR (coalesce(array_length(v_emails, 1), 0) > 0 AND lower(btrim(st.client_email)) = ANY(v_emails)) ORDER BY st.id, st.created_at DESC NULLS LAST) src;
  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_replacement_tickets FROM (SELECT DISTINCT ON (rt.id) rt.* FROM public.replacement_tickets rt WHERE rt.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND rt.linked_order_id = ANY(v_order_ids)) OR (coalesce(array_length(v_emails, 1), 0) > 0 AND lower(btrim(rt.client_email)) = ANY(v_emails)) ORDER BY rt.id, rt.created_at DESC NULLS LAST) src;
  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_replacement_orders FROM (SELECT DISTINCT ON (ro.id) ro.* FROM public.replacement_orders ro WHERE ro.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND ro.original_order_id = ANY(v_order_ids)) OR (coalesce(array_length(v_emails, 1), 0) > 0 AND lower(btrim(ro.client_email)) = ANY(v_emails)) ORDER BY ro.id, ro.created_at DESC NULLS LAST) src;
  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_cancellation_requests FROM (SELECT DISTINCT ON (cr.id) cr.* FROM public.service_cancellation_requests cr WHERE cr.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_account_ids, 1), 0) > 0 AND cr.account_id = ANY(v_account_ids)) OR (coalesce(array_length(v_subscription_ids, 1), 0) > 0 AND cr.subscription_id = ANY(v_subscription_ids)) ORDER BY cr.id, cr.created_at DESC NULLS LAST) src;
  SELECT coalesce(jsonb_agg(to_jsonb(pm) ORDER BY pm.is_default DESC NULLS LAST, pm.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_payment_methods FROM public.payment_methods pm WHERE pm.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) AND pm.deleted_at IS NULL;
  SELECT coalesce(jsonb_agg(to_jsonb(au) ORDER BY au.is_primary DESC NULLS LAST, au.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_authorized_contacts FROM public.authorized_users au WHERE au.client_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[]));
  SELECT coalesce(jsonb_agg(to_jsonb(wft) ORDER BY wft.updated_at DESC NULLS LAST, wft.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_web_form_threads FROM public.web_form_threads wft WHERE wft.linked_user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_emails, 1), 0) > 0 AND lower(btrim(wft.contact_email)) = ANY(v_emails));
  SELECT coalesce(jsonb_agg(to_jsonb(lp) ORDER BY lp.updated_at DESC NULLS LAST), '[]'::jsonb) INTO v_loyalty_points FROM public.loyalty_points lp WHERE lp.client_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_account_ids, 1), 0) > 0 AND lp.account_id = ANY(v_account_ids));
  SELECT coalesce(jsonb_agg(to_jsonb(lt) ORDER BY lt.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_loyalty_transactions FROM public.loyalty_transactions lt WHERE coalesce(array_length(v_account_ids, 1), 0) > 0 AND lt.account_id = ANY(v_account_ids);
  SELECT coalesce(jsonb_agg(to_jsonb(ivs) ORDER BY ivs.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_identity_verifications FROM public.identity_verification_sessions ivs WHERE ivs.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND ivs.order_id = ANY(v_order_ids));
  SELECT coalesce(jsonb_agg(to_jsonb(dr) ORDER BY dr.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_document_requests FROM public.document_requests dr WHERE dr.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[]));
  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb) INTO v_activity FROM (SELECT * FROM (SELECT cal.id, cal.created_at, 'client_activity_logs'::text AS source, cal.action_type::text AS action, cal.entity_type::text, cal.entity_id, cal.actor_name, cal.actor_role, cal.summary::text AS summary, cal.before_data, cal.after_data, NULL::jsonb AS details FROM public.client_activity_logs cal WHERE cal.client_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND cal.entity_id = ANY(v_order_ids)) OR (coalesce(array_length(v_subscription_ids, 1), 0) > 0 AND cal.entity_id = ANY(v_subscription_ids)) OR (coalesce(array_length(v_equipment_ids, 1), 0) > 0 AND cal.entity_id = ANY(v_equipment_ids)) UNION ALL SELECT al.id, al.created_at, 'activity_logs'::text AS source, al.action::text AS action, al.entity_type::text, al.entity_id, al.actor_name, al.actor_role, coalesce(al.reason, al.changed_field, al.action)::text AS summary, NULL::jsonb AS before_data, NULL::jsonb AS after_data, al.details FROM public.activity_logs al WHERE al.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND al.entity_id = ANY(v_order_ids)) OR (coalesce(array_length(v_subscription_ids, 1), 0) > 0 AND al.entity_id = ANY(v_subscription_ids)) UNION ALL SELECT osh.id, osh.created_at, 'order_status_history'::text AS source, coalesce(osh.new_status, 'status_change')::text AS action, 'order'::text AS entity_type, osh.order_id AS entity_id, osh.actor_name, osh.actor_role, osh.change_reason::text AS summary, jsonb_build_object('status', osh.old_status) AS before_data, jsonb_build_object('status', osh.new_status) AS after_data, osh.metadata AS details FROM public.order_status_history osh WHERE coalesce(array_length(v_order_ids, 1), 0) > 0 AND osh.order_id = ANY(v_order_ids) UNION ALL SELECT eal.id, eal.created_at, 'equipment_audit_log'::text AS source, eal.action::text AS action, 'equipment'::text AS entity_type, eal.equipment_id AS entity_id, eal.actor_name, NULL::text AS actor_role, eal.action::text AS summary, jsonb_build_object('status', eal.old_status) AS before_data, jsonb_build_object('status', eal.new_status) AS after_data, eal.details FROM public.equipment_audit_log eal WHERE coalesce(array_length(v_equipment_ids, 1), 0) > 0 AND eal.equipment_id = ANY(v_equipment_ids) UNION ALL SELECT bsta.id, bsta.created_at, 'billing_subscription_trace_audit'::text AS source, bsta.action::text AS action, 'subscription'::text AS entity_type, bsta.subscription_id AS entity_id, NULL::text AS actor_name, NULL::text AS actor_role, bsta.reason::text AS summary, NULL::jsonb AS before_data, NULL::jsonb AS after_data, bsta.details FROM public.billing_subscription_trace_audit bsta WHERE (coalesce(array_length(v_subscription_ids, 1), 0) > 0 AND bsta.subscription_id = ANY(v_subscription_ids)) OR (coalesce(array_length(v_customer_ids, 1), 0) > 0 AND bsta.customer_id = ANY(v_customer_ids)) UNION ALL SELECT oal.id, oal.created_at, 'order_automation_log'::text AS source, oal.action::text AS action, oal.entity_type::text, coalesce(oal.entity_id, oal.order_id) AS entity_id, NULL::text AS actor_name, 'system'::text AS actor_role, oal.action::text AS summary, NULL::jsonb AS before_data, NULL::jsonb AS after_data, oal.details FROM public.order_automation_log oal WHERE coalesce(array_length(v_order_ids, 1), 0) > 0 AND oal.order_id = ANY(v_order_ids) UNION ALL SELECT ap.id, ap.created_at, 'appointments'::text AS source, coalesce(ap.status, 'scheduled')::text AS action, 'appointment'::text AS entity_type, ap.id AS entity_id, NULL::text AS actor_name, 'system'::text AS actor_role, coalesce(ap.title, ap.appointment_number, 'Rendez-vous')::text AS summary, NULL::jsonb AS before_data, to_jsonb(ap) AS after_data, NULL::jsonb AS details FROM public.appointments ap WHERE ap.client_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND ap.order_id = ANY(v_order_ids)) OR (coalesce(array_length(v_emails, 1), 0) > 0 AND lower(btrim(ap.client_email)) = ANY(v_emails)) UNION ALL SELECT st.id, st.created_at, 'support_tickets'::text AS source, coalesce(st.status, 'open')::text AS action, 'support_ticket'::text AS entity_type, st.id AS entity_id, NULL::text AS actor_name, coalesce(st.created_by_role, 'client')::text AS actor_role, coalesce(st.subject, st.ticket_number, 'Ticket')::text AS summary, NULL::jsonb AS before_data, to_jsonb(st) AS after_data, NULL::jsonb AS details FROM public.support_tickets st WHERE st.user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR st.owner_user_id = ANY(coalesce(v_related_user_ids, ARRAY[]::uuid[])) OR (coalesce(array_length(v_account_ids, 1), 0) > 0 AND st.account_id = ANY(v_account_ids)) OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND st.related_order_id = ANY(v_order_ids)) OR (coalesce(array_length(v_emails, 1), 0) > 0 AND lower(btrim(st.client_email)) = ANY(v_emails))) unioned ORDER BY unioned.created_at DESC NULLS LAST LIMIT 300) src;

  RETURN jsonb_build_object('profile', CASE WHEN v_has_profile THEN to_jsonb(v_profile) ELSE NULL END, 'account', v_account, 'billingCustomer', v_billing_customer, 'orders', v_orders, 'orderLifecycle', v_order_lifecycle, 'invoices', v_invoices, 'monthlyInvoices', v_monthly_invoices, 'payments', v_payments, 'legacyPayments', v_legacy_payments, 'contracts', v_contracts, 'autoDocuments', v_auto_documents, 'clientDocuments', v_client_documents, 'orderDocuments', v_order_documents, 'paymentProofs', v_payment_proofs, 'subscriptions', v_subscriptions, 'serviceInstances', v_service_instances, 'serviceAddresses', v_service_addresses, 'equipment', v_equipment, 'phoneOrders', v_phone_orders, 'appointments', v_appointments, 'supportTickets', v_support_tickets, 'replacementTickets', v_replacement_tickets, 'replacementOrders', v_replacement_orders, 'cancellationRequests', v_cancellation_requests, 'paymentMethods', v_payment_methods, 'authorizedContacts', v_authorized_contacts, 'webFormThreads', v_web_form_threads, 'loyaltyPoints', v_loyalty_points, 'loyaltyTransactions', v_loyalty_transactions, 'identityVerifications', v_identity_verifications, 'documentRequests', v_document_requests, 'activity', v_activity, 'identifiers', jsonb_build_object('userId', _user_id, 'relatedUserIds', to_jsonb(coalesce(v_related_user_ids, ARRAY[]::uuid[])), 'clientNumber', CASE WHEN v_has_profile THEN v_profile.client_number ELSE NULL END, 'profileEmail', CASE WHEN v_has_profile THEN v_profile.email ELSE v_auth_email END, 'authEmail', v_auth_email, 'emails', to_jsonb(coalesce(v_emails, ARRAY[]::text[])), 'accountId', coalesce(v_account->>'id', NULL), 'accountIds', to_jsonb(coalesce(v_account_ids, ARRAY[]::uuid[])), 'customerIds', to_jsonb(coalesce(v_customer_ids, ARRAY[]::uuid[])), 'orderIds', to_jsonb(coalesce(v_order_ids, ARRAY[]::uuid[])), 'subscriptionIds', to_jsonb(coalesce(v_subscription_ids, ARRAY[]::uuid[])), 'usedEmailFallback', v_used_email_fallback));
END;
$function$;

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
  v_row_id uuid;
  v_uid uuid;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  v_customer_id := nullif(to_jsonb(r)->>'customer_id', '')::uuid;
  v_account_id := nullif(to_jsonb(r)->>'account_id', '')::uuid;
  v_order_id := coalesce(nullif(to_jsonb(r)->>'order_id', '')::uuid, nullif(to_jsonb(r)->>'related_order_id', '')::uuid);
  v_subscription_id := nullif(to_jsonb(r)->>'subscription_id', '')::uuid;
  v_row_id := nullif(to_jsonb(r)->>'id', '')::uuid;

  SELECT array_remove(array_agg(DISTINCT user_id), NULL) INTO v_user_ids
  FROM (
    SELECT nullif(to_jsonb(r)->>'user_id', '')::uuid AS user_id
    UNION SELECT nullif(to_jsonb(r)->>'client_id', '')::uuid
    UNION SELECT nullif(to_jsonb(r)->>'owner_user_id', '')::uuid
    UNION SELECT nullif(to_jsonb(r)->>'created_by_user_id', '')::uuid
    UNION SELECT bc.user_id FROM public.billing_customers bc WHERE bc.id = v_customer_id
    UNION SELECT a.client_id FROM public.accounts a WHERE a.id = v_account_id
    UNION SELECT o.user_id FROM public.orders o WHERE o.id = v_order_id
    UNION SELECT a.client_id FROM public.accounts a JOIN public.orders o ON o.account_id = a.id WHERE o.id = v_order_id
    UNION SELECT bc.user_id FROM public.billing_customers bc JOIN public.billing_subscriptions bs ON bs.customer_id = bc.id WHERE bs.id = v_subscription_id
  ) u;

  FOREACH v_uid IN ARRAY coalesce(v_user_ids, ARRAY[]::uuid[]) LOOP
    INSERT INTO public.customer_portal_projection_events (user_id, event_source, event_id, payload, status)
    VALUES (v_uid, TG_TABLE_NAME, v_row_id, jsonb_build_object('operation', TG_OP, 'table', TG_TABLE_NAME), 'processed');

    BEGIN
      PERFORM public.refresh_customer_portal_snapshot_internal(v_uid, TG_TABLE_NAME, v_row_id);
      UPDATE public.customer_portal_projection_events
      SET processed_at = now(), attempts = attempts + 1
      WHERE id = currval(pg_get_serial_sequence('customer_portal_projection_events','id'))::uuid;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.customer_portal_projection_logs (user_id, event_source, event_id, status, message, details)
      VALUES (v_uid, TG_TABLE_NAME, v_row_id, 'error', SQLERRM, jsonb_build_object('operation', TG_OP, 'sqlstate', SQLSTATE));
    END;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_client_history_snapshot(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_client_history_snapshot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_history_snapshot(uuid) TO service_role;