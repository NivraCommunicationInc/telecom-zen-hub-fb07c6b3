CREATE OR REPLACE FUNCTION public.resolve_or_create_service_address(
  p_account_id uuid,
  p_address text,
  p_city text,
  p_province text,
  p_postal text,
  p_created_via text,
  p_actor_user_id uuid DEFAULT NULL::uuid,
  p_order_id uuid DEFAULT NULL::uuid,
  p_employee_id uuid DEFAULT NULL::uuid,
  p_field_agent_id uuid DEFAULT NULL::uuid,
  p_label text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_norm_addr text := lower(regexp_replace(coalesce(p_address,''), '\s+', ' ', 'g'));
  v_norm_postal text := upper(regexp_replace(coalesce(p_postal,''), '\s+', '', 'g'));
BEGIN
  IF p_account_id IS NULL OR p_address IS NULL OR btrim(p_address) = '' THEN
    RAISE EXCEPTION 'account_id and address required';
  END IF;

  IF p_created_via NOT IN ('guest_checkout','portal','field','core','pos','employee','backfill','migration','admin','legacy') THEN
    RAISE EXCEPTION 'invalid created_via: %', p_created_via;
  END IF;

  -- First return only a visible address. The previous version ignored deleted_at,
  -- so adding a previously removed address returned a hidden id and the UI showed a false success.
  SELECT id INTO v_id
  FROM public.service_addresses
  WHERE account_id = p_account_id
    AND is_active = true
    AND deleted_at IS NULL
    AND lower(regexp_replace(coalesce(address_line,''), '\s+', ' ', 'g')) = v_norm_addr
    AND upper(regexp_replace(coalesce(postal_code,''), '\s+', '', 'g')) = v_norm_postal
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- If the matching address exists but was soft-deleted, reactivate it instead of
  -- returning an invisible row or creating a duplicate blocked by the account/hash index.
  SELECT id INTO v_id
  FROM public.service_addresses
  WHERE account_id = p_account_id
    AND lower(regexp_replace(coalesce(address_line,''), '\s+', ' ', 'g')) = v_norm_addr
    AND upper(regexp_replace(coalesce(postal_code,''), '\s+', '', 'g')) = v_norm_postal
  ORDER BY deleted_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.service_addresses
    SET
      address_line = p_address,
      city = p_city,
      province = coalesce(p_province, 'QC'),
      postal_code = p_postal,
      label = coalesce(p_label, label),
      is_active = true,
      deleted_at = NULL,
      created_by_user_id = coalesce(p_actor_user_id, created_by_user_id),
      created_via = p_created_via,
      created_from_order_id = coalesce(p_order_id, created_from_order_id),
      created_by_employee_id = coalesce(p_employee_id, created_by_employee_id),
      created_by_field_agent_id = coalesce(p_field_agent_id, created_by_field_agent_id)
    WHERE id = v_id
    RETURNING id INTO v_id;

    RETURN v_id;
  END IF;

  INSERT INTO public.service_addresses(
    account_id, label, address_line, city, province, postal_code,
    is_active, is_default, created_by_user_id, created_via, created_from_order_id,
    created_by_employee_id, created_by_field_agent_id
  ) VALUES (
    p_account_id,
    coalesce(p_label, 'Adresse ' || (
      SELECT count(*) + 1
      FROM public.service_addresses
      WHERE account_id = p_account_id
        AND is_active = true
        AND deleted_at IS NULL
    )::text),
    p_address, p_city, coalesce(p_province,'QC'), p_postal,
    true,
    NOT EXISTS (
      SELECT 1
      FROM public.service_addresses s2
      WHERE s2.account_id = p_account_id
        AND s2.is_default = true
        AND s2.is_active = true
        AND s2.deleted_at IS NULL
    ),
    p_actor_user_id, p_created_via, p_order_id,
    p_employee_id, p_field_agent_id
  ) RETURNING id INTO v_id;

  RETURN v_id;
END
$$;

GRANT EXECUTE ON FUNCTION public.resolve_or_create_service_address(uuid,text,text,text,text,text,uuid,uuid,uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_or_create_service_address(uuid,text,text,text,text,text,uuid,uuid,uuid,uuid,text) TO service_role;