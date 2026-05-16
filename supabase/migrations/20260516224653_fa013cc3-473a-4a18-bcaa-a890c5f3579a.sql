CREATE OR REPLACE FUNCTION public.get_contract_for_signing(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_token_hash text;
  v_contract record;
  v_order record;
  v_invoice record;
  v_client_full_name text;
  v_client_email text;
  v_client_phone text;
  v_account_number text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('success', false, 'error', 'TOKEN_INVALID');
  END IF;

  v_token_hash := encode(extensions.digest(p_token::bytea, 'sha256'), 'hex');

  SELECT c.* INTO v_contract
  FROM public.contracts c
  WHERE (c.signature_token_hash = v_token_hash OR c.signature_token = p_token)
    AND c.signature_token IS NOT NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'TOKEN_NOT_FOUND');
  END IF;

  IF v_contract.signature_token_expires_at IS NOT NULL
     AND v_contract.signature_token_expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'TOKEN_EXPIRED');
  END IF;

  IF v_contract.client_signed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_signed', true,
      'signed_at', v_contract.client_signed_at,
      'contract_number', v_contract.contract_number
    );
  END IF;

  IF v_contract.order_id IS NOT NULL THEN
    SELECT
      o.id,
      o.order_number,
      o.service_type,
      o.total_amount,
      o.created_at,
      COALESCE(o.client_full_address, o.shipping_address) AS service_address,
      o.shipping_city AS service_city,
      o.shipping_postal_code AS service_postal_code,
      o.shipping_province AS service_province,
      o.user_id,
      o.client_email,
      o.client_first_name,
      o.client_last_name,
      o.client_phone,
      o.account_id
    INTO v_order
    FROM public.orders o
    WHERE o.id = v_contract.order_id;

    IF FOUND THEN
      v_client_full_name := trim(concat_ws(' ', v_order.client_first_name, v_order.client_last_name));
      v_client_email := v_order.client_email;
      v_client_phone := v_order.client_phone;

      IF v_order.user_id IS NOT NULL THEN
        SELECT
          COALESCE(p.full_name, v_client_full_name),
          COALESCE(p.email, v_client_email),
          COALESCE(p.phone, v_client_phone)
        INTO v_client_full_name, v_client_email, v_client_phone
        FROM public.profiles p
        WHERE p.user_id = v_order.user_id
        LIMIT 1;
      END IF;

      IF v_order.account_id IS NOT NULL THEN
        SELECT a.account_number INTO v_account_number
        FROM public.accounts a
        WHERE a.id = v_order.account_id
        LIMIT 1;
      END IF;

      IF v_account_number IS NULL AND v_order.user_id IS NOT NULL THEN
        SELECT a.account_number INTO v_account_number
        FROM public.accounts a
        WHERE a.client_id = v_order.user_id
        ORDER BY a.created_at DESC
        LIMIT 1;
      END IF;

      SELECT bi.invoice_number, bi.total, bi.subtotal, bi.tps_amount, bi.tvq_amount
      INTO v_invoice
      FROM public.billing_invoices bi
      WHERE bi.order_id = v_contract.order_id
      ORDER BY bi.created_at DESC
      LIMIT 1;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_signed', false,
    'contract', jsonb_build_object(
      'id', v_contract.id,
      'contract_number', v_contract.contract_number,
      'contract_name', v_contract.contract_name,
      'version', v_contract.version,
      'created_at', v_contract.created_at,
      'expires_at', v_contract.signature_token_expires_at,
      'contract_pdf_url', v_contract.contract_pdf_url
    ),
    'order', CASE WHEN v_order.id IS NOT NULL THEN jsonb_build_object(
      'id', v_order.id,
      'order_number', v_order.order_number,
      'service_type', v_order.service_type,
      'total_amount', v_order.total_amount,
      'created_at', v_order.created_at,
      'service_address', v_order.service_address,
      'service_city', v_order.service_city,
      'service_postal_code', v_order.service_postal_code,
      'service_province', v_order.service_province
    ) ELSE NULL END,
    'client', jsonb_build_object(
      'full_name', NULLIF(v_client_full_name, ''),
      'email', v_client_email,
      'phone', v_client_phone
    ),
    'account_number', v_account_number,
    'invoice', CASE WHEN v_invoice.invoice_number IS NOT NULL THEN jsonb_build_object(
      'invoice_number', v_invoice.invoice_number,
      'total', v_invoice.total,
      'subtotal', v_invoice.subtotal,
      'tps_amount', v_invoice.tps_amount,
      'tvq_amount', v_invoice.tvq_amount
    ) ELSE NULL END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_contract_signature_token(
  p_token text,
  p_signer_ip text,
  p_signer_user_agent text,
  p_signer_name text DEFAULT NULL::text,
  p_consent boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_token_hash text;
  v_contract record;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('success', false, 'error', 'TOKEN_INVALID');
  END IF;

  IF p_consent IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'CONSENT_REQUIRED');
  END IF;

  v_token_hash := encode(extensions.digest(p_token::bytea, 'sha256'), 'hex');

  SELECT c.* INTO v_contract
  FROM public.contracts c
  WHERE (c.signature_token_hash = v_token_hash OR c.signature_token = p_token)
    AND c.signature_token IS NOT NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'TOKEN_NOT_FOUND');
  END IF;

  IF v_contract.signature_token_expires_at IS NOT NULL
     AND v_contract.signature_token_expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'TOKEN_EXPIRED');
  END IF;

  IF v_contract.client_signed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_SIGNED',
      'signed_at', v_contract.client_signed_at,
      'contract_id', v_contract.id
    );
  END IF;

  UPDATE public.contracts
  SET
    client_signed_at         = now(),
    signed_at                = COALESCE(signed_at, now()),
    is_signed                = true,
    client_signed_ip         = p_signer_ip,
    client_signed_user_agent = p_signer_user_agent,
    client_signer_name       = COALESCE(p_signer_name, client_signer_name),
    client_consent_accepted  = true,
    signature_method         = COALESCE(signature_method, 'click_to_sign'),
    signature_token_hash     = COALESCE(signature_token_hash, v_token_hash),
    signature_token_used_at  = now(),
    status                   = CASE
                                 WHEN admin_signed_at IS NOT NULL THEN 'fully_signed'
                                 ELSE 'signed_by_client'
                               END,
    updated_at               = now()
  WHERE id = v_contract.id;

  RETURN jsonb_build_object(
    'success', true,
    'contract_id', v_contract.id,
    'order_id', v_contract.order_id,
    'signed_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_contract_for_signing(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contract_for_signing(text) TO service_role;
REVOKE ALL ON FUNCTION public.consume_contract_signature_token(text, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_contract_signature_token(text, text, text, text, boolean) TO service_role;

NOTIFY pgrst, 'reload schema';