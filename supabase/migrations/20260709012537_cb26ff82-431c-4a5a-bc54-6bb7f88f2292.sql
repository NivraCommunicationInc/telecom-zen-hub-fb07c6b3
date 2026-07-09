
-- Simulation RPC for Register Payment module (Client 360)
-- Read-only. Returns invoice snapshot + projected state after payment.
CREATE OR REPLACE FUNCTION public.core_simulate_record_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_method text DEFAULT 'manual'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inv        public.billing_invoices%ROWTYPE;
  v_new_paid   numeric(10,2);
  v_new_bal    numeric(10,2);
  v_new_status text;
  v_overpay    boolean;
  v_customer   record;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
       OR public.has_role(auth.uid(), 'staff'::app_role)
       OR public.has_role(auth.uid(), 'core'::app_role)) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE='insufficient_privilege';
  END IF;

  IF p_invoice_id IS NULL THEN
    RAISE EXCEPTION 'p_invoice_id required' USING ERRCODE='invalid_parameter_value';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'p_amount must be > 0' USING ERRCODE='invalid_parameter_value';
  END IF;

  SELECT * INTO v_inv FROM public.billing_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invoice not found' USING ERRCODE='no_data_found';
  END IF;

  SELECT email, first_name, last_name
    INTO v_customer
    FROM public.billing_customers
    WHERE id = v_inv.customer_id;

  v_new_paid := COALESCE(v_inv.amount_paid,0) + p_amount;
  v_new_bal  := GREATEST(0, COALESCE(v_inv.total,0) - v_new_paid);
  v_overpay  := v_new_paid > COALESCE(v_inv.total,0) + 0.005;
  v_new_status := CASE
    WHEN v_new_paid >= COALESCE(v_inv.total,0) THEN 'paid'
    WHEN v_new_paid > 0                       THEN COALESCE(v_inv.status::text,'pending')
    ELSE COALESCE(v_inv.status::text,'pending')
  END;

  RETURN jsonb_build_object(
    'invoice_id',       v_inv.id,
    'invoice_number',   v_inv.invoice_number,
    'currency',         COALESCE(v_inv.currency,'CAD'),
    'before', jsonb_build_object(
      'total',        v_inv.total,
      'amount_paid',  v_inv.amount_paid,
      'balance_due',  v_inv.balance_due,
      'status',       v_inv.status
    ),
    'after', jsonb_build_object(
      'amount_paid',  v_new_paid,
      'balance_due',  v_new_bal,
      'status',       v_new_status,
      'will_be_paid', v_new_paid >= COALESCE(v_inv.total,0)
    ),
    'overpayment', v_overpay,
    'customer',    jsonb_build_object(
      'email',      v_customer.email,
      'first_name', v_customer.first_name,
      'last_name',  v_customer.last_name
    ),
    'method',      p_method,
    'receipt_email_planned', v_customer.email IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.core_simulate_record_payment(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.core_simulate_record_payment(uuid, numeric, text)
  TO authenticated, service_role;
