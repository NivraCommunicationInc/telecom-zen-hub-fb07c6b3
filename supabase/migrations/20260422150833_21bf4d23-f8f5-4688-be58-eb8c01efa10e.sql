CREATE OR REPLACE FUNCTION public.ensure_profile_client_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_number IS NULL OR btrim(NEW.client_number) = '' THEN
    NEW.client_number := public.generate_client_number();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_ensure_client_number ON public.profiles;
CREATE TRIGGER trg_profiles_ensure_client_number
BEFORE INSERT OR UPDATE OF client_number ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.ensure_profile_client_number();

UPDATE public.profiles
SET client_number = public.generate_client_number()
WHERE client_number IS NULL OR btrim(client_number) = '';

ALTER TABLE public.profiles
ALTER COLUMN client_number SET NOT NULL;

CREATE OR REPLACE FUNCTION public.get_client_history_snapshot(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_customer_ids uuid[] := ARRAY[]::uuid[];
  v_order_ids uuid[] := ARRAY[]::uuid[];
  v_email text := null;
BEGIN
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
      'identifiers', jsonb_build_object(
        'userId', _user_id,
        'clientNumber', NULL,
        'profileEmail', NULL,
        'accountId', NULL,
        'customerIds', '[]'::jsonb,
        'orderIds', '[]'::jsonb,
        'usedEmailFallback', false
      )
    );
  END IF;

  v_email := lower(nullif(btrim(v_profile.email), ''));

  SELECT to_jsonb(a) INTO v_account
  FROM public.accounts a
  WHERE a.client_id = _user_id
  ORDER BY a.created_at DESC
  LIMIT 1;

  SELECT array_remove(array_agg(DISTINCT bc.id), NULL)
  INTO v_customer_ids
  FROM public.billing_customers bc
  WHERE bc.user_id = _user_id
     OR (v_email IS NOT NULL AND lower(btrim(bc.email)) = v_email);

  IF coalesce(array_length(v_customer_ids, 1), 0) > 0 THEN
    SELECT to_jsonb(bc) INTO v_billing_customer
    FROM public.billing_customers bc
    WHERE bc.id = ANY(v_customer_ids)
    ORDER BY bc.created_at DESC NULLS LAST, bc.updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  SELECT array_remove(array_agg(DISTINCT o.id), NULL)
  INTO v_order_ids
  FROM public.orders o
  WHERE o.user_id = _user_id
     OR (v_email IS NOT NULL AND lower(btrim(o.client_email)) = v_email)
     OR (
       coalesce(array_length(v_customer_ids, 1), 0) > 0
       AND EXISTS (
         SELECT 1
         FROM public.billing_invoices bi
         WHERE bi.order_id = o.id
           AND bi.customer_id = ANY(v_customer_ids)
       )
     );

  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_orders
  FROM (
    SELECT DISTINCT ON (o.id) o.*
    FROM public.orders o
    WHERE coalesce(array_length(v_order_ids, 1), 0) > 0
      AND o.id = ANY(v_order_ids)
    ORDER BY o.id, o.created_at DESC NULLS LAST
  ) src;

  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.updated_at DESC NULLS LAST, src.created_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_order_lifecycle
  FROM (
    SELECT DISTINCT ON (ol.order_id) ol.*
    FROM public.order_lifecycle ol
    WHERE coalesce(array_length(v_order_ids, 1), 0) > 0
      AND ol.order_id = ANY(v_order_ids)
    ORDER BY ol.order_id, ol.updated_at DESC NULLS LAST, ol.created_at DESC NULLS LAST
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
         SELECT 1
         FROM public.billing_invoices bi
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
       OR (
         v_account IS NOT NULL
         AND (v_account->>'id') IS NOT NULL
         AND d.account_id = (v_account->>'id')::uuid
       )
    ORDER BY d.id, d.created_at DESC NULLS LAST
  ) src;

  SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_subscriptions
  FROM (
    SELECT DISTINCT ON (s.id) s.*
    FROM public.billing_subscriptions s
    WHERE (coalesce(array_length(v_customer_ids, 1), 0) > 0 AND s.customer_id = ANY(v_customer_ids))
       OR (coalesce(array_length(v_order_ids, 1), 0) > 0 AND s.order_id = ANY(v_order_ids))
    ORDER BY s.id, s.created_at DESC NULLS LAST
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
    'identifiers', jsonb_build_object(
      'userId', _user_id,
      'clientNumber', v_profile.client_number,
      'profileEmail', v_profile.email,
      'accountId', CASE WHEN v_account IS NULL THEN NULL ELSE v_account->>'id' END,
      'customerIds', to_jsonb(coalesce(v_customer_ids, ARRAY[]::uuid[])),
      'orderIds', to_jsonb(coalesce(v_order_ids, ARRAY[]::uuid[])),
      'usedEmailFallback', EXISTS (
        SELECT 1
        FROM public.billing_customers bc
        WHERE bc.user_id IS DISTINCT FROM _user_id
          AND v_email IS NOT NULL
          AND lower(btrim(bc.email)) = v_email
      ) OR EXISTS (
        SELECT 1
        FROM public.orders o
        WHERE o.user_id IS DISTINCT FROM _user_id
          AND v_email IS NOT NULL
          AND lower(btrim(o.client_email)) = v_email
      )
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_client_identity_links(_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  client_number text,
  profile_email text,
  account_id uuid,
  billing_customer_ids uuid[],
  order_ids uuid[],
  invoice_count integer,
  payment_count integer,
  contract_count integer,
  auto_document_count integer,
  used_email_fallback boolean,
  is_consistent boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  snapshot jsonb;
  v_customer_ids uuid[] := ARRAY[]::uuid[];
  v_order_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  snapshot := public.get_client_history_snapshot(_user_id);
  v_customer_ids := ARRAY(
    SELECT value::text::uuid
    FROM jsonb_array_elements_text(coalesce(snapshot->'identifiers'->'customerIds', '[]'::jsonb))
  );
  v_order_ids := ARRAY(
    SELECT value::text::uuid
    FROM jsonb_array_elements_text(coalesce(snapshot->'identifiers'->'orderIds', '[]'::jsonb))
  );

  RETURN QUERY
  SELECT
    _user_id,
    snapshot->'identifiers'->>'clientNumber',
    snapshot->'identifiers'->>'profileEmail',
    nullif(snapshot->'identifiers'->>'accountId', '')::uuid,
    v_customer_ids,
    v_order_ids,
    jsonb_array_length(coalesce(snapshot->'invoices', '[]'::jsonb)),
    jsonb_array_length(coalesce(snapshot->'payments', '[]'::jsonb)),
    jsonb_array_length(coalesce(snapshot->'contracts', '[]'::jsonb)),
    jsonb_array_length(coalesce(snapshot->'autoDocuments', '[]'::jsonb)),
    coalesce((snapshot->'identifiers'->>'usedEmailFallback')::boolean, false),
    (
      (snapshot->'identifiers'->>'clientNumber') IS NOT NULL
      AND (
        coalesce(array_length(v_customer_ids, 1), 0) > 0
        OR coalesce(array_length(v_order_ids, 1), 0) > 0
        OR jsonb_array_length(coalesce(snapshot->'contracts', '[]'::jsonb)) > 0
        OR jsonb_array_length(coalesce(snapshot->'autoDocuments', '[]'::jsonb)) > 0
      )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_client_history_snapshot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_history_snapshot(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.verify_client_identity_links(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_client_identity_links(uuid) TO authenticated;

ALTER TABLE public.profiles REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;