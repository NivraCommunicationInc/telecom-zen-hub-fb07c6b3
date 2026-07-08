-- Enrich get_contract_for_signing:
--  1) Compute REAL monthly recurring subtotal + total_with_taxes from order_items (is_recurring=true)
--  2) Return line_items breakdown (services, equipment, fees, promos) so the signing page
--     matches the PDF contract
--  3) Expose contract_pdf_url (storage path) so a signed URL can be produced for viewing

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
  v_line_items jsonb := '[]'::jsonb;
  v_recurring_subtotal numeric := 0;
  v_recurring_total numeric := 0;
  v_tax_rate numeric := 0;
  v_first_invoice_total numeric := 0;
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
      o.account_id,
      COALESCE(o.tps_rate, 0.05) AS tps_rate,
      COALESCE(o.tvq_rate, 0.09975) AS tvq_rate
    INTO v_order
    FROM public.orders o
    WHERE o.id = v_contract.order_id;

    IF FOUND THEN
      v_client_full_name := trim(concat_ws(' ', v_order.client_first_name, v_order.client_last_name));
      v_client_email := v_order.client_email;
      v_client_phone := v_order.client_phone;
      v_first_invoice_total := v_order.total_amount;
      v_tax_rate := v_order.tps_rate + v_order.tvq_rate;

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

      -- Build line items + compute recurring monthly total
      SELECT
        COALESCE(jsonb_agg(
          jsonb_build_object(
            'plan_name', oi.plan_name,
            'plan_code', oi.plan_code,
            'service_type', oi.service_type,
            'is_recurring', oi.is_recurring,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'line_total', oi.line_total
          )
          ORDER BY oi.is_recurring DESC, oi.created_at
        ), '[]'::jsonb),
        COALESCE(SUM(CASE WHEN oi.is_recurring THEN oi.line_total ELSE 0 END), 0)
      INTO v_line_items, v_recurring_subtotal
      FROM public.order_items oi
      WHERE oi.order_id = v_contract.order_id;

      v_recurring_total := round(v_recurring_subtotal * (1 + v_tax_rate), 2);
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
      'contract_pdf_url', v_contract.contract_pdf_url,
      'has_pdf', v_contract.contract_pdf_url IS NOT NULL
    ),
    'order', CASE WHEN v_order.id IS NOT NULL THEN jsonb_build_object(
      'id', v_order.id,
      'order_number', v_order.order_number,
      'service_type', v_order.service_type,
      'total_amount', v_order.total_amount,
      'first_invoice_total', v_first_invoice_total,
      'monthly_recurring_subtotal', v_recurring_subtotal,
      'monthly_recurring_total', v_recurring_total,
      'tps_rate', v_order.tps_rate,
      'tvq_rate', v_order.tvq_rate,
      'created_at', v_order.created_at,
      'service_address', v_order.service_address,
      'service_city', v_order.service_city,
      'service_postal_code', v_order.service_postal_code,
      'service_province', v_order.service_province,
      'line_items', v_line_items
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

REVOKE ALL ON FUNCTION public.get_contract_for_signing(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contract_for_signing(text) TO service_role;

NOTIFY pgrst, 'reload schema';