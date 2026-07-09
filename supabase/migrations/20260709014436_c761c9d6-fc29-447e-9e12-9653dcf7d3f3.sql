
-- Client 360 · Unified Adjustments simulator
-- Read-only RPC that previews the impact of a credit / fee / promotion
-- (applied on the N next invoice cycles) or an invoice write-off.
CREATE OR REPLACE FUNCTION public.core_simulate_adjustment(
  p_account_id uuid,
  p_kind       text,              -- 'credit' | 'fee' | 'promotion' | 'invoice_writeoff'
  p_amount     numeric DEFAULT 0,
  p_months     integer DEFAULT 1,
  p_invoice_id uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_acc      public.accounts%ROWTYPE;
  v_monthly  numeric := 0;
  v_active_credit numeric := 0;
  v_active_fee    numeric := 0;
  v_active_promo  numeric := 0;
  v_inv      public.billing_invoices%ROWTYPE;
  v_cust     record;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role)
       OR public.has_role(auth.uid(),'staff'::app_role)
       OR public.has_role(auth.uid(),'core'::app_role)) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE='insufficient_privilege';
  END IF;

  IF p_kind NOT IN ('credit','fee','promotion','invoice_writeoff') THEN
    RAISE EXCEPTION 'invalid kind: %', p_kind USING ERRCODE='invalid_parameter_value';
  END IF;

  SELECT * INTO v_acc FROM public.accounts WHERE id = p_account_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account not found' USING ERRCODE='no_data_found';
  END IF;

  -- Current active load from ongoing adjustments/promotions
  SELECT COALESCE(SUM(amount),0)
    INTO v_active_credit
    FROM public.account_adjustments
    WHERE account_id = p_account_id AND type='credit' AND status='active';

  SELECT COALESCE(SUM(amount),0)
    INTO v_active_fee
    FROM public.account_adjustments
    WHERE account_id = p_account_id AND type='fee' AND status='active';

  SELECT COALESCE(SUM(amount),0)
    INTO v_active_promo
    FROM public.account_promotions
    WHERE account_id = p_account_id AND is_active = true AND months_remaining > 0;

  IF p_kind = 'invoice_writeoff' THEN
    IF p_invoice_id IS NULL THEN
      RAISE EXCEPTION 'p_invoice_id required for write-off' USING ERRCODE='invalid_parameter_value';
    END IF;
    SELECT * INTO v_inv FROM public.billing_invoices WHERE id = p_invoice_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'invoice not found' USING ERRCODE='no_data_found';
    END IF;
    SELECT email, first_name, last_name INTO v_cust
      FROM public.billing_customers WHERE id = v_inv.customer_id;

    RETURN jsonb_build_object(
      'kind','invoice_writeoff',
      'account_id', p_account_id,
      'invoice', jsonb_build_object(
        'id', v_inv.id,
        'invoice_number', v_inv.invoice_number,
        'total', v_inv.total,
        'balance_due', v_inv.balance_due,
        'status', v_inv.status
      ),
      'before', jsonb_build_object(
        'balance_due', v_inv.balance_due,
        'status', v_inv.status
      ),
      'after', jsonb_build_object(
        'balance_due', v_inv.balance_due,
        'status', 'written_off (via collections_actions)',
        'note', 'La facture reste avec le solde impayé mais est marquée radiée. Un ticket collections écrit dans collections_actions.'
      ),
      'customer', jsonb_build_object(
        'email', v_cust.email, 'first_name', v_cust.first_name, 'last_name', v_cust.last_name
      ),
      'client_email_planned', false,
      'requires_admin_role', true
    );
  END IF;

  -- credit / fee / promotion
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'p_amount must be > 0' USING ERRCODE='invalid_parameter_value';
  END IF;
  IF p_months IS NULL OR p_months < 1 OR p_months > 24 THEN
    RAISE EXCEPTION 'p_months must be 1..24' USING ERRCODE='invalid_parameter_value';
  END IF;

  RETURN jsonb_build_object(
    'kind', p_kind,
    'account_id', p_account_id,
    'amount_per_month', p_amount,
    'months', p_months,
    'cumulative_total', p_amount * p_months,
    'before', jsonb_build_object(
      'active_credits_monthly', v_active_credit,
      'active_fees_monthly',    v_active_fee,
      'active_promos_monthly',  v_active_promo
    ),
    'after', jsonb_build_object(
      'active_credits_monthly',
        v_active_credit + CASE WHEN p_kind='credit' THEN p_amount ELSE 0 END,
      'active_fees_monthly',
        v_active_fee + CASE WHEN p_kind='fee' THEN p_amount ELSE 0 END,
      'active_promos_monthly',
        v_active_promo + CASE WHEN p_kind='promotion' THEN p_amount ELSE 0 END
    ),
    'target_table',
      CASE WHEN p_kind='promotion' THEN 'account_promotions' ELSE 'account_adjustments' END,
    'client_email_planned', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.core_simulate_adjustment(uuid,text,numeric,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.core_simulate_adjustment(uuid,text,numeric,integer,uuid)
  TO authenticated, service_role;
