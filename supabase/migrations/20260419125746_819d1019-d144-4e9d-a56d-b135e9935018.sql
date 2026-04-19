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
  IF NEW.status <> 'paid' OR (OLD IS NOT NULL AND OLD.status = 'paid') THEN
    RETURN NEW;
  END IF;

  IF NEW.type <> 'renewal' THEN
    RETURN NEW;
  END IF;

  IF NEW.subscription_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, customer_id, status, cycle_start_date, cycle_end_date, plan_name
    INTO v_sub
    FROM public.billing_subscriptions
   WHERE id = NEW.subscription_id;

  IF v_sub.status <> 'suspended' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_existing_fee_count
    FROM public.billing_invoices
   WHERE customer_id = NEW.customer_id
     AND type = 'adjustment'
     AND notes LIKE '%[REACTIVATION]%'
     AND notes LIKE '%' || NEW.id::text || '%';

  IF v_existing_fee_count > 0 THEN
    RETURN NEW;
  END IF;

  v_tps := round(v_fee_amount * 0.05, 2);
  v_tvq := round(v_fee_amount * 0.09975, 2);
  v_total := v_fee_amount + v_tps + v_tvq;

  v_cycle_start := CURRENT_DATE;
  v_cycle_end := CURRENT_DATE + 30;
  v_due_date := CURRENT_DATE + 7;

  SELECT generate_billing_invoice_number() INTO v_new_invoice_number;

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
    'adjustment',
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

  UPDATE public.billing_subscriptions
     SET status = 'active', updated_at = now()
   WHERE id = NEW.subscription_id;

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