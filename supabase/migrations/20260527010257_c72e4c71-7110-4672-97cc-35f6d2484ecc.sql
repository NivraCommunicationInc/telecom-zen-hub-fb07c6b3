CREATE OR REPLACE FUNCTION public.fn_is_equipment_label(_label text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(btrim(coalesce(_label, ''))) IN (
    'borne wifi',
    'terminal tv',
    'sim',
    'carte sim',
    'esim',
    'routeur',
    'router',
    'wifi router'
  )
$$;

CREATE OR REPLACE FUNCTION public.guard_billing_subscription_plan_from_equipment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_plan_name text;
  v_plan_price numeric;
  v_plan_code text;
  v_category text;
BEGIN
  IF NEW.order_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.fn_is_equipment_label(NEW.plan_name) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = NEW.order_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_plan_name := nullif(btrim(coalesce(v_order.pricing_snapshot->>'plan_name', v_order.service_type)), '');
  v_plan_price := nullif(v_order.pricing_snapshot->>'plan_price', '')::numeric;
  v_plan_code := nullif(btrim(coalesce(v_order.pricing_snapshot->>'plan_id', NEW.plan_code)), '');
  v_category := nullif(btrim(coalesce(v_order.pricing_snapshot->>'plan_category', v_order.service_type, NEW.service_category)), '');

  IF v_plan_name IS NOT NULL THEN
    NEW.plan_name := v_plan_name;
  END IF;

  IF v_plan_price IS NOT NULL AND v_plan_price > 0 THEN
    NEW.plan_price := v_plan_price;
  END IF;

  IF v_plan_code IS NOT NULL THEN
    NEW.plan_code := v_plan_code;
  END IF;

  IF v_category IS NOT NULL THEN
    NEW.service_category := v_category;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_billing_subscription_plan_from_equipment ON public.billing_subscriptions;
CREATE TRIGGER trg_guard_billing_subscription_plan_from_equipment
BEFORE INSERT OR UPDATE OF plan_name, plan_price, plan_code, service_category, order_id
ON public.billing_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.guard_billing_subscription_plan_from_equipment();

CREATE OR REPLACE FUNCTION public.guard_billing_subscription_service_from_equipment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sub public.billing_subscriptions%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_plan_name text;
  v_plan_price numeric;
  v_plan_code text;
  v_category text;
BEGIN
  IF NEW.service_type IS DISTINCT FROM 'recurring' THEN
    RETURN NEW;
  END IF;

  IF NOT public.fn_is_equipment_label(NEW.service_name) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_sub
  FROM public.billing_subscriptions
  WHERE id = NEW.subscription_id
  LIMIT 1;

  IF NOT FOUND OR v_sub.order_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_sub.order_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_plan_name := nullif(btrim(coalesce(v_order.pricing_snapshot->>'plan_name', v_order.service_type)), '');
  v_plan_price := nullif(v_order.pricing_snapshot->>'plan_price', '')::numeric;
  v_plan_code := nullif(btrim(coalesce(v_order.pricing_snapshot->>'plan_id', v_sub.plan_code, NEW.service_code)), '');
  v_category := lower(nullif(btrim(coalesce(v_order.pricing_snapshot->>'plan_category', v_order.service_type, v_sub.service_category, 'service')), ''));

  IF v_plan_name IS NOT NULL THEN
    NEW.service_name := v_plan_name;
  END IF;

  IF v_plan_price IS NOT NULL AND v_plan_price > 0 THEN
    NEW.unit_price := v_plan_price;
  END IF;

  IF v_plan_code IS NOT NULL THEN
    NEW.service_code := v_plan_code;
  END IF;

  IF v_category IS NOT NULL THEN
    NEW.service_type := v_category;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_billing_subscription_service_from_equipment ON public.billing_subscription_services;
CREATE TRIGGER trg_guard_billing_subscription_service_from_equipment
BEFORE INSERT OR UPDATE OF service_name, service_type, service_code, unit_price, subscription_id
ON public.billing_subscription_services
FOR EACH ROW
EXECUTE FUNCTION public.guard_billing_subscription_service_from_equipment();

UPDATE public.billing_subscriptions bs
SET
  plan_name = COALESCE(NULLIF(btrim(o.pricing_snapshot->>'plan_name'), ''), NULLIF(btrim(o.service_type), ''), bs.plan_name),
  plan_price = COALESCE(NULLIF(o.pricing_snapshot->>'plan_price', '')::numeric, bs.plan_price),
  plan_code = COALESCE(NULLIF(btrim(o.pricing_snapshot->>'plan_id'), ''), bs.plan_code),
  service_category = COALESCE(NULLIF(btrim(o.pricing_snapshot->>'plan_category'), ''), NULLIF(btrim(o.service_type), ''), bs.service_category),
  updated_at = now()
FROM public.orders o
WHERE bs.order_id = o.id
  AND public.fn_is_equipment_label(bs.plan_name)
  AND COALESCE(NULLIF(btrim(o.pricing_snapshot->>'plan_name'), ''), NULLIF(btrim(o.service_type), '')) IS NOT NULL;

UPDATE public.billing_subscription_services bss
SET
  service_name = COALESCE(NULLIF(btrim(o.pricing_snapshot->>'plan_name'), ''), NULLIF(btrim(o.service_type), ''), bss.service_name),
  unit_price = COALESCE(NULLIF(o.pricing_snapshot->>'plan_price', '')::numeric, bss.unit_price),
  service_code = COALESCE(NULLIF(btrim(o.pricing_snapshot->>'plan_id'), ''), bss.service_code),
  service_type = lower(COALESCE(NULLIF(btrim(o.pricing_snapshot->>'plan_category'), ''), NULLIF(btrim(o.service_type), ''), 'service')),
  updated_at = now()
FROM public.billing_subscriptions bs
JOIN public.orders o ON o.id = bs.order_id
WHERE bss.subscription_id = bs.id
  AND bss.service_type = 'recurring'
  AND public.fn_is_equipment_label(bss.service_name)
  AND COALESCE(NULLIF(btrim(o.pricing_snapshot->>'plan_name'), ''), NULLIF(btrim(o.service_type), '')) IS NOT NULL;

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
  v_emails text[] := ARRAY[]::text[];
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

  IF FOUND AND nullif(btrim(v_profile.email), '') IS NOT NULL THEN
    v_emails := array_append(v_emails, lower(btrim(v_profile.email)));
  END IF;

  SELECT array_remove(array_agg(DISTINCT email), NULL)
  INTO v_emails
  FROM (
    SELECT unnest(coalesce(v_emails, ARRAY[]::text[])) AS email
    UNION
    SELECT lower(btrim(bc.email))
    FROM public.billing_customers bc
    WHERE bc.user_id = _user_id AND nullif(btrim(bc.email), '') IS NOT NULL
    UNION
    SELECT lower(btrim(o.client_email))
    FROM public.orders o
    WHERE o.user_id = _user_id AND nullif(btrim(o.client_email), '') IS NOT NULL
  ) e;

  SELECT array_remove(array_agg(DISTINCT bc.id), NULL)
  INTO v_customer_ids
  FROM public.billing_customers bc
  WHERE bc.user_id = _user_id
     OR (coalesce(array_length(v_emails, 1), 0) > 0 AND lower(btrim(bc.email)) = ANY(v_emails));

  IF EXISTS (
    SELECT 1 FROM public.billing_customers bc
    WHERE coalesce(array_length(v_emails, 1), 0) > 0
      AND lower(btrim(bc.email)) = ANY(v_emails)
      AND bc.user_id IS DISTINCT FROM _user_id
  ) THEN
    v_used_email_fallback := true;
  END IF;

  SELECT array_remove(array_agg(DISTINCT a.id), NULL)
  INTO v_account_ids
  FROM public.accounts a
  WHERE a.client_id = _user_id
     OR (coalesce(array_length(v_customer_ids, 1), 0) > 0 AND a.client_id = ANY(v_customer_ids));

  SELECT array_remove(array_agg(DISTINCT o.id), NULL)
  INTO v_order_ids
  FROM public.orders o
  WHERE o.user_id = _user_id
     OR (coalesce(array_length(v_account_ids, 1), 0) > 0 AND o.account_id = ANY(v_account_ids))
     OR (coalesce(array_length(v_emails, 1), 0) > 0 AND lower(btrim(o.client_email)) = ANY(v_emails))
     OR (
       coalesce(array_length(v_customer_ids, 1), 0) > 0
       AND EXISTS (
         SELECT 1 FROM public.billing_invoices bi
         WHERE bi.order_id = o.id
           AND bi.customer_id = ANY(v_customer_ids)
       )
     )
     OR (
       coalesce(array_length(v_customer_ids, 1), 0) > 0
       AND EXISTS (
         SELECT 1 FROM public.billing_subscriptions bs
         WHERE bs.order_id = o.id
           AND bs.customer_id = ANY(v_customer_ids)
       )
     );

  IF EXISTS (
    SELECT 1 FROM public.orders o
    WHERE coalesce(array_length(v_emails, 1), 0) > 0
      AND lower(btrim(o.client_email)) = ANY(v_emails)
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
    WHERE (si.user_id = _user_id OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND si.order_id = ANY(v_order_ids)))
      AND si.account_id IS NOT NULL
  ) resolved_accounts;

  SELECT COALESCE(to_jsonb(a), 'null'::jsonb)
  INTO v_account
  FROM (
    SELECT *
    FROM public.accounts
    WHERE id = ANY(coalesce(v_account_ids, ARRAY[]::uuid[]))
    ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, created_at DESC
    LIMIT 1
  ) a;

  IF coalesce(array_length(v_customer_ids, 1), 0) > 0 THEN
    SELECT to_jsonb(bc) INTO v_billing_customer
    FROM public.billing_customers bc
    WHERE bc.id = ANY(v_customer_ids)
    ORDER BY CASE WHEN bc.user_id = _user_id THEN 0 ELSE 1 END, bc.created_at DESC NULLS LAST, bc.updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

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
       OR (coalesce(array_length(v_emails, 1), 0) > 0 AND lower(btrim(d.recipient_email)) = ANY(v_emails))
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
    'profile', CASE WHEN FOUND THEN to_jsonb(v_profile) ELSE NULL END,
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
      'clientNumber', CASE WHEN FOUND THEN v_profile.client_number ELSE NULL END,
      'profileEmail', CASE WHEN FOUND THEN v_profile.email ELSE NULL END,
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