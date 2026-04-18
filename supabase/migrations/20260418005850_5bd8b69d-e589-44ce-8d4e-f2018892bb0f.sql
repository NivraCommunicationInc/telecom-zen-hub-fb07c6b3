
-- ============================================================================
-- P1 GAP #3+#4: Allow 'cancelled' status on accounts + add cancelled_at column
-- ============================================================================
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_status_check;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_status_check
  CHECK (status = ANY (ARRAY['active'::text, 'suspended'::text, 'closed'::text, 'cancelled'::text]));

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone;
CREATE INDEX IF NOT EXISTS idx_accounts_cancelled_at ON public.accounts(cancelled_at) WHERE cancelled_at IS NOT NULL;

-- ============================================================================
-- P2 GAP #5+#6: data_retention_log table for Loi 25 anonymization audit
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.data_retention_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  account_id uuid,
  account_number text,
  cancelled_at timestamp with time zone,
  anonymized_at timestamp with time zone NOT NULL DEFAULT now(),
  fields_anonymized jsonb NOT NULL DEFAULT '[]'::jsonb,
  documents_deleted integer DEFAULT 0,
  triggered_by text NOT NULL DEFAULT 'cron_billing_data_retention',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_retention_log_client_id ON public.data_retention_log(client_id);
CREATE INDEX IF NOT EXISTS idx_data_retention_log_anonymized_at ON public.data_retention_log(anonymized_at DESC);

ALTER TABLE public.data_retention_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all retention logs"
  ON public.data_retention_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Service role can insert retention logs"
  ON public.data_retention_log FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- P1 GAP #2: Reactivation fee trigger
-- When a client pays an overdue invoice while subscription was suspended (J+5..J+10),
-- automatically generate a separate $15 reactivation fee invoice.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_create_reactivation_fee_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_existing_fee_count integer;
  v_new_invoice_id uuid;
  v_new_invoice_number text;
  v_fee_amount numeric := 15.00;
  v_tps numeric;
  v_tvq numeric;
  v_total numeric;
  v_due_date date;
  v_cycle_start date;
  v_cycle_end date;
BEGIN
  -- Only trigger when invoice transitions to 'paid' (from a non-paid state)
  IF NEW.status <> 'paid' OR (OLD IS NOT NULL AND OLD.status = 'paid') THEN
    RETURN NEW;
  END IF;

  -- Only renewal/cycle invoices are eligible (skip reactivation fees themselves, activations, etc.)
  IF NEW.type NOT IN ('renewal', 'cycle') THEN
    RETURN NEW;
  END IF;

  -- Need a subscription to check suspended state
  IF NEW.subscription_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if subscription is currently suspended (was suspended at payment time)
  SELECT id, customer_id, status, cycle_start_date, cycle_end_date, plan_name
    INTO v_sub
    FROM public.billing_subscriptions
   WHERE id = NEW.subscription_id;

  IF v_sub.status <> 'suspended' THEN
    RETURN NEW;
  END IF;

  -- Idempotency: skip if a reactivation fee invoice already exists referencing this paid invoice
  SELECT count(*) INTO v_existing_fee_count
    FROM public.billing_invoices
   WHERE customer_id = NEW.customer_id
     AND type = 'reactivation_fee'
     AND notes LIKE '%' || NEW.id::text || '%';

  IF v_existing_fee_count > 0 THEN
    RETURN NEW;
  END IF;

  -- Compute taxes: TPS 5%, TVQ 9.975%
  v_tps := round(v_fee_amount * 0.05, 2);
  v_tvq := round(v_fee_amount * 0.09975, 2);
  v_total := v_fee_amount + v_tps + v_tvq;

  v_cycle_start := CURRENT_DATE;
  v_cycle_end := CURRENT_DATE + 30;
  v_due_date := CURRENT_DATE + 7; -- 7 days to pay reactivation fee

  -- Generate invoice number
  SELECT generate_billing_invoice_number() INTO v_new_invoice_number;

  -- Create reactivation fee invoice
  INSERT INTO public.billing_invoices (
    customer_id,
    subscription_id,
    invoice_number,
    type,
    subtotal,
    tps_amount,
    tvq_amount,
    total,
    balance_due,
    currency,
    status,
    cycle_start_date,
    cycle_end_date,
    due_date,
    notes,
    environment,
    payment_method
  ) VALUES (
    NEW.customer_id,
    NEW.subscription_id,
    v_new_invoice_number,
    'reactivation_fee',
    v_fee_amount,
    v_tps,
    v_tvq,
    v_total,
    v_total,
    'CAD',
    'pending',
    v_cycle_start,
    v_cycle_end,
    v_due_date,
    '[REACTIVATION] Frais de réactivation suite au paiement tardif de facture ' || NEW.invoice_number || ' (paid_invoice_id=' || NEW.id::text || ')',
    COALESCE(NEW.environment, 'live'),
    'paypal'
  )
  RETURNING id INTO v_new_invoice_id;

  -- Add the line item
  INSERT INTO public.billing_invoice_lines (
    invoice_id,
    description,
    line_type,
    quantity,
    unit_price,
    line_total
  ) VALUES (
    v_new_invoice_id,
    'Frais de réactivation / Reactivation fee',
    'fee',
    1,
    v_fee_amount,
    v_fee_amount
  );

  -- Reactivate the subscription back to active (client paid)
  UPDATE public.billing_subscriptions
     SET status = 'active', updated_at = now()
   WHERE id = NEW.subscription_id;

  -- Log to subscription trace audit
  INSERT INTO public.billing_subscription_trace_audit (
    subscription_id, customer_id, action, source_type, source_id, details, reason
  ) VALUES (
    NEW.subscription_id,
    NEW.customer_id,
    'reactivation_fee_created',
    'trigger',
    NEW.id::text,
    jsonb_build_object(
      'paid_invoice_id', NEW.id,
      'paid_invoice_number', NEW.invoice_number,
      'reactivation_invoice_id', v_new_invoice_id,
      'reactivation_invoice_number', v_new_invoice_number,
      'fee_amount', v_fee_amount,
      'total_with_tax', v_total
    ),
    'Service réactivé après paiement tardif — frais 15$ ajoutés'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_reactivation_fee_on_payment ON public.billing_invoices;
CREATE TRIGGER trg_create_reactivation_fee_on_payment
AFTER UPDATE OF status ON public.billing_invoices
FOR EACH ROW
EXECUTE FUNCTION public.fn_create_reactivation_fee_on_payment();
