CREATE OR REPLACE FUNCTION public.fn_resolve_service_address_for_links(
  _account_id uuid DEFAULT NULL,
  _order_id uuid DEFAULT NULL,
  _client_id uuid DEFAULT NULL,
  _service_address text DEFAULT NULL,
  _service_city text DEFAULT NULL,
  _postal_code text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account_id uuid := _account_id;
  v_order record;
  v_addr uuid;
  v_lookup_address text := _service_address;
  v_lookup_city text := _service_city;
  v_lookup_postal text := _postal_code;
BEGIN
  IF _order_id IS NOT NULL THEN
    SELECT o.id, o.account_id, o.user_id, o.service_address_id,
           coalesce(o.shipping_address, o.shipping_address_line, o.client_full_address) AS order_address,
           o.shipping_city AS order_city,
           o.shipping_postal_code AS order_postal
    INTO v_order
    FROM public.orders o
    WHERE o.id = _order_id
    LIMIT 1;

    IF FOUND THEN
      IF v_order.service_address_id IS NOT NULL THEN
        RETURN v_order.service_address_id;
      END IF;
      v_account_id := coalesce(v_account_id, v_order.account_id);
      v_lookup_address := coalesce(nullif(v_lookup_address, ''), v_order.order_address);
      v_lookup_city := coalesce(nullif(v_lookup_city, ''), v_order.order_city);
      v_lookup_postal := coalesce(nullif(v_lookup_postal, ''), v_order.order_postal);
    END IF;
  END IF;

  IF v_account_id IS NULL AND _client_id IS NOT NULL THEN
    SELECT a.id INTO v_account_id
    FROM public.accounts a
    WHERE a.client_id = _client_id
    ORDER BY CASE WHEN a.status = 'active' THEN 0 ELSE 1 END, a.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_account_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT sa.id INTO v_addr
  FROM public.service_addresses sa
  WHERE sa.account_id = v_account_id
    AND sa.deleted_at IS NULL
    AND nullif(btrim(coalesce(v_lookup_postal, '')), '') IS NOT NULL
    AND lower(regexp_replace(coalesce(sa.postal_code, ''), '\s+', '', 'g')) = lower(regexp_replace(v_lookup_postal, '\s+', '', 'g'))
  ORDER BY sa.is_primary DESC NULLS LAST, sa.is_active DESC NULLS LAST, sa.created_at ASC
  LIMIT 1;
  IF v_addr IS NOT NULL THEN RETURN v_addr; END IF;

  SELECT sa.id INTO v_addr
  FROM public.service_addresses sa
  WHERE sa.account_id = v_account_id
    AND sa.deleted_at IS NULL
    AND nullif(btrim(coalesce(v_lookup_address, '')), '') IS NOT NULL
    AND lower(btrim(sa.address_line)) = lower(btrim(v_lookup_address))
  ORDER BY sa.is_primary DESC NULLS LAST, sa.is_active DESC NULLS LAST, sa.created_at ASC
  LIMIT 1;
  IF v_addr IS NOT NULL THEN RETURN v_addr; END IF;

  SELECT sa.id INTO v_addr
  FROM public.service_addresses sa
  WHERE sa.account_id = v_account_id
    AND sa.deleted_at IS NULL
  ORDER BY sa.is_primary DESC NULLS LAST, sa.is_active DESC NULLS LAST, sa.created_at ASC
  LIMIT 1;

  RETURN v_addr;
END;
$$;