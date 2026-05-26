CREATE OR REPLACE FUNCTION public.get_client_history_snapshot(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_account jsonb := 'null'::jsonb;
  v_billing_customer jsonb := 'null'::jsonb;
  v_orders jsonb := '[]'::jsonb;
  v_order_lifecycle jsonb := '[]'::jsonb;
  v_invoices jsonb := '[]'::jsonb;
  v_payments jsonb := '[]'::jsonb;
  v_contracts jsonb := '[]'::jsonb;
  v_auto_documents jsonb := '[]'::jsonb;
  v_subscriptions jsonb := '[]'::jsonb;
  v_service_instances jsonb := '[]'::jsonb;
  v_equipment jsonb := '[]'::jsonb;
  v_customer_ids uuid[] := ARRAY[]::uuid[];
  v_order_ids uuid[] := ARRAY[]::uuid[];
  v_account_ids uuid[] := ARRAY[]::uuid[];
  v_subscription_ids uuid[] := ARRAY[]::uuid[];
  v_email text := null;
  v_used_email_fallback boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF auth.uid() <> _user_id
     AND NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'moderator')) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'profile', NULL,
      'account', NULL,
      'billingCustomer', NULL,
      'orders', '[]'::jsonb,
      'orderLifecycle', '[]'::jsonb,
      'invoices', '[]'::jsonb,
      'payments', '[]'::jsonb,
      'contracts', '[]'::jsonb,
      'autoDocuments', '[]'::jsonb,
      'subscriptions', '[]'::jsonb,
      'serviceInstances', '[]'::jsonb,
      'equipment', '[]'::jsonb,
      'identifiers', jsonb_build_object(
        'userId', _user_id,
        'clientNumber', NULL,
        'profileEmail', NULL,
        'accountId', NULL,
        'accountIds', '[]'::jsonb,
        'customerIds', '[]'::jsonb,
        'orderIds', '[]'::jsonb,
        'subscriptionIds', '[]'::jsonb,
        'usedEmailFallback', false
      )
    );
  END IF;

  v_email := lower(nullif(btrim(v_profile.email), ''));

  SELECT array_remove(array_agg(DISTINCT a.id), NULL)
  INTO v_account_ids
  FROM public.accounts a
  WHERE a.client_id = _user_id;

  SELECT COALESCE(to_jsonb(a), 'null'::jsonb)
  INTO v_account
  FROM (
    SELECT *
    FROM public.accounts
    WHERE id = ANY(coalesce(v_account_ids, ARRAY[]::uuid[]))
    ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, created_at DESC
    LIMIT 1
  ) a;

  SELECT array_remove(array_agg(DISTINCT bc.id), NULL)
  INTO v_customer_ids
  FROM public.billing_customers bc
  WHERE bc.user_id = _user_id
     OR (v_email IS NOT NULL AND lower(btrim(bc.email)) = v_email);

  IF EXISTS (
    SELECT 1 FROM public.billing_customers bc
    WHERE v_email IS NOT NULL
      AND lower(btrim(bc.email)) = v_email
      AND bc.user_id IS DISTINCT FROM _user_id
  ) THEN
    v_used_email_fallback := true;
  END IF;

  IF coalesce(array_length(v_customer_ids, 1), 0) > 0 THEN
    SELECT to_jsonb(bc) INTO v_billing_customer
    FROM public.billing_customers bc
    WHERE bc.id = ANY(v_customer_ids)
    ORDER BY CASE WHEN bc.user_id = _user_id THEN 0 ELSE 1 END, bc.created_at DESC NULLS LAST, bc.updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  SELECT array_remove(array_agg(DISTINCT o.id), NULL)
  INTO v_order_ids
  FROM public.orders o
  WHERE o.user_id = _user_id
     OR (coalesce(array_length(v_account_ids, 1), 0) > 0 AND o.account_id = ANY(v_account_ids))
     OR (v_email IS NOT NULL AND lower(btrim(o.client_email)) = v_email)
     OR (
       coalesce(array_length(v_customer_ids, 1), 0) > 0
       AND EXISTS (
         SELECT 1 FROM public.billing_invoices bi
         WHERE bi.order_id = o.id
           AND bi.customer_id = ANY(v_customer_ids)
       )
     );

  IF EXISTS (
    SELECT 1 FROM public.orders o
    WHERE v_email IS NOT NULL
      AND lower(btrim(o.client_email)) = v_email
      AND o.user_id IS DISTINCT FROM _user_id
  ) THEN
    v_used_email_fallback := true;
  END IF;

  SELECT array_remove(array_agg(DISTINCT account_id), NULL)
  INTO v_account_ids
  FROM (
    SELECT unnest(coalesce(v_account_ids, ARRAY[]::uuid[])) AS account_id
    UNION
    SELECT o.account_id
    FROM public.orders o
    WHERE coalesce(array_length(v_order_ids, 1), 0) > 0
      AND o.id = ANY(v_order_ids)
      AND o.account_id IS NOT NULL
    UNION
    SELECT si.account_id
    FROM public.service_instances si
    WHERE si.user_id = _user_id
      AND si.account_id IS NOT NULL
  ) resolved_accounts;

  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_orders
  FROM (
    SELECT DISTINCT ON (o.id) o.*
    FROM public.orders o
    WHERE coalesce(array_length(v_order_ids, 1), 0) > 0
      AND o.id = ANY(v_order_ids)
    ORDER BY o.id, o.created_at DESC NULLS LAST
  ) src;

  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.order_created_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_order_lifecycle
  FROM (
    SELECT DISTINCT ON (ol.order_id) ol.*
    FROM public.order_lifecycle ol
    WHERE coalesce(array_length(v_order_ids, 1), 0) > 0
      AND ol.order_id = ANY(v_order_ids)
    ORDER BY ol.order_id, ol.order_created_at DESC NULLS LAST
  ) src;

  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_invoices
  FROM (
    SELECT DISTINCT ON (bi.id) bi.*
    FROM public.billing_invoices bi
    WHERE (coalesce(array_length(v_customer_ids, 1), 0) > 0 AND bi.customer_id = ANY(v_customer_ids))
       OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND bi.order_id = ANY(v_order_ids))
    ORDER BY bi.id, bi.created_at DESC NULLS LAST
  ) src;

  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_payments
  FROM (
    SELECT DISTINCT ON (bp.id) bp.*
    FROM public.billing_payments bp
    WHERE (coalesce(array_length(v_customer_ids, 1), 0) > 0 AND bp.customer_id = ANY(v_customer_ids))
       OR EXISTS (
         SELECT 1 FROM public.billing_invoices bi
         WHERE bi.id = bp.invoice_id
           AND (
             (coalesce(array_length(v_customer_ids, 1), 0) > 0 AND bi.customer_id = ANY(v_customer_ids))
             OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND bi.order_id = ANY(v_order_ids))
           )
       )
    ORDER BY bp.id, bp.created_at DESC NULLS LAST
  ) src;

  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_contracts
  FROM (
    SELECT DISTINCT ON (c.id) c.*
    FROM public.contracts c
    WHERE c.owner_user_id = _user_id
       OR c.user_id = _user_id
       OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND c.order_id = ANY(v_order_ids))
    ORDER BY c.id, c.created_at DESC NULLS LAST
  ) src;

  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_auto_documents
  FROM (
    SELECT DISTINCT ON (d.id) d.*
    FROM public.client_auto_documents d
    WHERE d.client_id = _user_id
       OR (coalesce(array_length(v_account_ids, 1), 0) > 0 AND d.account_id = ANY(v_account_ids))
       OR (v_email IS NOT NULL AND lower(btrim(d.recipient_email)) = v_email)
    ORDER BY d.id, d.created_at DESC NULLS LAST
  ) src;

  SELECT array_remove(array_agg(DISTINCT s.id), NULL)
  INTO v_subscription_ids
  FROM public.billing_subscriptions s
  WHERE (coalesce(array_length(v_customer_ids, 1), 0) > 0 AND s.customer_id = ANY(v_customer_ids))
     OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND s.order_id = ANY(v_order_ids));

  SELECT coalesce(
    jsonb_agg(
      to_jsonb(src)
      || jsonb_build_object(
        'billing_subscription_services', coalesce((
          SELECT jsonb_agg(to_jsonb(bss) ORDER BY bss.created_at ASC NULLS LAST)
          FROM public.billing_subscription_services bss
          WHERE bss.subscription_id = src.id
        ), '[]'::jsonb),
        'service_addresses', coalesce((
          SELECT to_jsonb(sa)
          FROM public.service_addresses sa
          WHERE sa.id = src.address_id
          LIMIT 1
        ), (
          SELECT jsonb_build_object(
            'id', NULL,
            'account_id', a.id,
            'label', coalesce(a.primary_service_city, a.billing_city, 'Adresse de service'),
            'address_line', coalesce(a.primary_service_address, a.billing_address),
            'city', coalesce(a.primary_service_city, a.billing_city),
            'province', coalesce(a.primary_service_province, a.billing_province),
            'postal_code', coalesce(a.primary_service_postal_code, a.billing_postal_code),
            'is_primary', true
          )
          FROM public.accounts a
          LEFT JOIN public.orders o ON o.id = src.order_id
          WHERE a.id = o.account_id OR a.id = ANY(coalesce(v_account_ids, ARRAY[]::uuid[]))
          ORDER BY CASE WHEN a.id = o.account_id THEN 0 ELSE 1 END, a.created_at DESC NULLS LAST
          LIMIT 1
        ), 'null'::jsonb)
      )
      ORDER BY src.created_at DESC NULLS LAST
    ),
    '[]'::jsonb
  )
  INTO v_subscriptions
  FROM (
    SELECT DISTINCT ON (s.id) s.*
    FROM public.billing_subscriptions s
    WHERE coalesce(array_length(v_subscription_ids, 1), 0) > 0
      AND s.id = ANY(v_subscription_ids)
    ORDER BY s.id, s.created_at DESC NULLS LAST
  ) src;

  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_service_instances
  FROM (
    SELECT DISTINCT ON (si.id) si.*
    FROM public.service_instances si
    WHERE si.user_id = _user_id
       OR (coalesce(array_length(v_account_ids, 1), 0) > 0 AND si.account_id = ANY(v_account_ids))
       OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND si.order_id = ANY(v_order_ids))
       OR (coalesce(array_length(v_subscription_ids, 1), 0) > 0 AND si.metadata->>'subscription_id' = ANY(v_subscription_ids::text[]))
    ORDER BY si.id, si.created_at DESC NULLS LAST
  ) src;

  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY COALESCE(src.deployed_at, src.assigned_at, src.created_at) DESC NULLS LAST), '[]'::jsonb)
  INTO v_equipment
  FROM (
    SELECT DISTINCT ON (ei.id) ei.*
    FROM public.equipment_inventory ei
    WHERE (coalesce(array_length(v_account_ids, 1), 0) > 0 AND ei.account_id = ANY(v_account_ids))
       OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND ei.order_id = ANY(v_order_ids))
       OR (coalesce(array_length(v_subscription_ids, 1), 0) > 0 AND ei.subscription_id = ANY(v_subscription_ids))
    ORDER BY ei.id, COALESCE(ei.deployed_at, ei.assigned_at, ei.created_at) DESC NULLS LAST
  ) src;

  RETURN jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'account', v_account,
    'billingCustomer', v_billing_customer,
    'orders', v_orders,
    'orderLifecycle', v_order_lifecycle,
    'invoices', v_invoices,
    'payments', v_payments,
    'contracts', v_contracts,
    'autoDocuments', v_auto_documents,
    'subscriptions', v_subscriptions,
    'serviceInstances', v_service_instances,
    'equipment', v_equipment,
    'identifiers', jsonb_build_object(
      'userId', _user_id,
      'clientNumber', v_profile.client_number,
      'profileEmail', v_profile.email,
      'accountId', coalesce(v_account->>'id', NULL),
      'accountIds', to_jsonb(coalesce(v_account_ids, ARRAY[]::uuid[])),
      'customerIds', to_jsonb(coalesce(v_customer_ids, ARRAY[]::uuid[])),
      'orderIds', to_jsonb(coalesce(v_order_ids, ARRAY[]::uuid[])),
      'subscriptionIds', to_jsonb(coalesce(v_subscription_ids, ARRAY[]::uuid[])),
      'usedEmailFallback', v_used_email_fallback
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_client_history_snapshot(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_client_history_snapshot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_history_snapshot(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.ensure_service_instance_from_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid;
  v_account_id uuid;
  v_order_service_type text;
BEGIN
  IF NEW.status::text <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT bc.user_id INTO v_user_id
  FROM public.billing_customers bc
  WHERE bc.id = NEW.customer_id
  LIMIT 1;

  IF NEW.order_id IS NOT NULL THEN
    SELECT o.account_id, o.user_id, nullif(btrim(o.service_type), '')
    INTO v_account_id, v_user_id, v_order_service_type
    FROM public.orders o
    WHERE o.id = NEW.order_id
    LIMIT 1;
  END IF;

  IF v_account_id IS NULL AND v_user_id IS NOT NULL THEN
    SELECT a.id INTO v_account_id
    FROM public.accounts a
    WHERE a.client_id = v_user_id
    ORDER BY CASE WHEN a.status = 'active' THEN 0 ELSE 1 END, a.created_at DESC
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.service_instances si
    WHERE si.user_id = v_user_id
      AND (
        (NEW.order_id IS NOT NULL AND si.order_id = NEW.order_id)
        OR si.metadata->>'subscription_id' = NEW.id::text
      )
  ) THEN
    INSERT INTO public.service_instances (
      user_id,
      account_id,
      order_id,
      service_type,
      plan_name,
      status,
      monthly_price,
      start_date,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      v_account_id,
      NEW.order_id,
      coalesce(nullif(btrim(NEW.service_category), ''), v_order_service_type, nullif(btrim(NEW.plan_code), ''), 'service'),
      coalesce(nullif(btrim(NEW.plan_name), ''), v_order_service_type, 'Service Nivra'),
      'active',
      coalesce(NEW.plan_price, 0),
      coalesce(NEW.cycle_start_date, CURRENT_DATE),
      jsonb_build_object('source', 'billing_subscription', 'subscription_id', NEW.id),
      now(),
      now()
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_ensure_service_instance_from_subscription ON public.billing_subscriptions;
CREATE TRIGGER trigger_ensure_service_instance_from_subscription
AFTER INSERT OR UPDATE OF status, customer_id, order_id, plan_name, plan_price, service_category
ON public.billing_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.ensure_service_instance_from_subscription();

REVOKE EXECUTE ON FUNCTION public.ensure_service_instance_from_subscription() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_service_instance_from_subscription() TO service_role;