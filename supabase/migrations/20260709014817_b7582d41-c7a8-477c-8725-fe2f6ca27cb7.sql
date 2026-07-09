
CREATE OR REPLACE FUNCTION public.core_simulate_adjustment(
  p_account_id uuid,
  p_kind text,
  p_amount numeric DEFAULT 0,
  p_months integer DEFAULT 1,
  p_invoice_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits_monthly numeric := 0;
  v_fees_monthly    numeric := 0;
  v_promos_monthly  numeric := 0;
  v_invoice jsonb;
BEGIN
  IF p_kind NOT IN ('credit','fee','promotion','invoice_writeoff') THEN
    RAISE EXCEPTION 'core_simulate_adjustment: invalid kind %', p_kind;
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN type = 'credit' THEN amount END), 0),
    COALESCE(SUM(CASE WHEN type = 'fee'    THEN amount END), 0)
  INTO v_credits_monthly, v_fees_monthly
  FROM public.account_adjustments
  WHERE account_id = p_account_id
    AND status = 'active'
    AND (months_remaining IS NULL OR months_remaining > 0);

  SELECT COALESCE(SUM(amount), 0)
  INTO v_promos_monthly
  FROM public.account_promotions
  WHERE account_id = p_account_id
    AND is_active IS TRUE
    AND (months_remaining IS NULL OR months_remaining > 0);

  IF p_kind = 'invoice_writeoff' THEN
    SELECT jsonb_build_object(
      'id', id,
      'invoice_number', invoice_number,
      'status', status,
      'balance_due', balance_due,
      'total_amount', total_amount
    )
    INTO v_invoice
    FROM public.billing_invoices
    WHERE id = p_invoice_id;

    RETURN jsonb_build_object(
      'kind', p_kind,
      'invoice', COALESCE(v_invoice, '{}'::jsonb),
      'before', jsonb_build_object(
        'active_credits_monthly', v_credits_monthly,
        'active_fees_monthly',    v_fees_monthly,
        'active_promos_monthly',  v_promos_monthly
      ),
      'after', jsonb_build_object(
        'active_credits_monthly', v_credits_monthly,
        'active_fees_monthly',    v_fees_monthly,
        'active_promos_monthly',  v_promos_monthly
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'kind', p_kind,
    'amount', p_amount,
    'months', p_months,
    'total_projected', COALESCE(p_amount, 0) * COALESCE(p_months, 0),
    'before', jsonb_build_object(
      'active_credits_monthly', v_credits_monthly,
      'active_fees_monthly',    v_fees_monthly,
      'active_promos_monthly',  v_promos_monthly
    ),
    'after', jsonb_build_object(
      'active_credits_monthly',
        v_credits_monthly + CASE WHEN p_kind = 'credit' THEN COALESCE(p_amount, 0) ELSE 0 END,
      'active_fees_monthly',
        v_fees_monthly    + CASE WHEN p_kind = 'fee'    THEN COALESCE(p_amount, 0) ELSE 0 END,
      'active_promos_monthly',
        v_promos_monthly  + CASE WHEN p_kind = 'promotion' THEN COALESCE(p_amount, 0) ELSE 0 END
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.core_simulate_adjustment(uuid, text, numeric, integer, uuid)
  TO authenticated, service_role;
