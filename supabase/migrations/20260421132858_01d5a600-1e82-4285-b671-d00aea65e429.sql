-- ============================================================================
-- Balance payment system: apply payment to multiple invoices FIFO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_customer_unpaid_invoices(p_customer_id uuid)
RETURNS TABLE(
  invoice_id uuid,
  invoice_number text,
  total numeric,
  amount_paid numeric,
  balance_due numeric,
  due_date date,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id, invoice_number, total, COALESCE(amount_paid,0), 
    GREATEST(0, COALESCE(balance_due, total - COALESCE(amount_paid,0))),
    due_date, status::text
  FROM billing_invoices
  WHERE customer_id = p_customer_id
    AND status NOT IN ('paid','paid_by_promo','void','cancelled','refunded')
    AND GREATEST(0, COALESCE(balance_due, total - COALESCE(amount_paid,0))) > 0
  ORDER BY due_date ASC, created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_unpaid_invoices(uuid) TO authenticated, service_role;

-- Apply a single PayPal capture amount across all unpaid invoices FIFO
CREATE OR REPLACE FUNCTION public.apply_balance_payment(
  p_customer_id uuid,
  p_amount numeric,
  p_provider text DEFAULT 'paypal',
  p_provider_payment_id text DEFAULT NULL,
  p_provider_order_id text DEFAULT NULL,
  p_method text DEFAULT 'paypal',
  p_source text DEFAULT 'client_portal',
  p_created_by_name text DEFAULT NULL,
  p_created_by_role text DEFAULT 'client'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining numeric := p_amount;
  v_inv RECORD;
  v_apply numeric;
  v_results jsonb := '[]'::jsonb;
  v_single_result jsonb;
  v_total_applied numeric := 0;
  v_invoice_count int := 0;
  v_seq_suffix int := 0;
  v_payment_id_used text;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be > 0');
  END IF;

  -- Idempotency: if a payment with this provider_payment_id already exists, return early
  IF p_provider_payment_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM billing_payments 
      WHERE provider_payment_id LIKE p_provider_payment_id || '%'
    ) THEN
      RETURN jsonb_build_object(
        'success', true, 
        'already_processed', true,
        'message', 'Balance payment already applied (idempotent)'
      );
    END IF;
  END IF;

  -- Iterate over unpaid invoices oldest-first, FOR UPDATE to prevent race
  FOR v_inv IN
    SELECT id, invoice_number, total, COALESCE(amount_paid,0) AS amount_paid,
           GREATEST(0, COALESCE(balance_due, total - COALESCE(amount_paid,0))) AS balance_due
    FROM billing_invoices
    WHERE customer_id = p_customer_id
      AND status NOT IN ('paid','paid_by_promo','void','cancelled','refunded')
      AND GREATEST(0, COALESCE(balance_due, total - COALESCE(amount_paid,0))) > 0
    ORDER BY due_date ASC NULLS LAST, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_apply := LEAST(v_remaining, v_inv.balance_due);
    IF v_apply <= 0 THEN CONTINUE; END IF;

    -- Build a unique provider_payment_id per invoice slice for idempotency
    v_seq_suffix := v_seq_suffix + 1;
    v_payment_id_used := COALESCE(p_provider_payment_id, 'balance_' || gen_random_uuid()::text) 
                         || '_inv_' || v_seq_suffix;

    SELECT public.apply_payment_to_invoice(
      p_invoice_id := v_inv.id,
      p_amount := v_apply,
      p_method := p_method,
      p_provider := p_provider,
      p_provider_payment_id := v_payment_id_used,
      p_provider_order_id := p_provider_order_id,
      p_customer_id := p_customer_id,
      p_source := p_source,
      p_created_by_name := p_created_by_name,
      p_created_by_role := p_created_by_role
    ) INTO v_single_result;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'invoice_id', v_inv.id,
      'invoice_number', v_inv.invoice_number,
      'amount_applied', v_apply,
      'result', v_single_result
    ));

    IF (v_single_result->>'success')::boolean = true OR (v_single_result->>'already_processed')::boolean = true THEN
      v_total_applied := v_total_applied + v_apply;
      v_invoice_count := v_invoice_count + 1;
      v_remaining := v_remaining - v_apply;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_applied', v_total_applied,
    'remaining_unallocated', v_remaining,
    'invoices_paid_count', v_invoice_count,
    'details', v_results
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_balance_payment(uuid, numeric, text, text, text, text, text, text, text) TO service_role;

-- ============================================================================
-- Daily overdue reminder log: idempotency for "1 email per invoice per day"
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.overdue_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  reminder_date date NOT NULL,
  email_queue_id uuid,
  recipient_email text NOT NULL,
  days_overdue int NOT NULL DEFAULT 0,
  invoice_balance numeric NOT NULL DEFAULT 0,
  total_account_balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, reminder_date)
);

CREATE INDEX IF NOT EXISTS idx_overdue_reminder_log_customer ON public.overdue_reminder_log(customer_id, reminder_date DESC);
CREATE INDEX IF NOT EXISTS idx_overdue_reminder_log_invoice ON public.overdue_reminder_log(invoice_id);

ALTER TABLE public.overdue_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view reminder logs"
ON public.overdue_reminder_log FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'billing_admin'::app_role));

CREATE POLICY "Service role can insert reminder logs"
ON public.overdue_reminder_log FOR INSERT
WITH CHECK (true);