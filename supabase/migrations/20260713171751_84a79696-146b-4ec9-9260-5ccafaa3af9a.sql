CREATE OR REPLACE FUNCTION public.trigger_payment_receipt_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_client_email text;
  v_client_name text;
  v_invoice RECORD;
  v_order RECORD;
  v_event_key text;
  v_confirmed_total numeric := 0;
  v_balance_due numeric := 0;
  v_is_fully_paid boolean := false;
BEGIN
  IF NOT (
    TG_OP = 'UPDATE'
    AND NEW.status = 'confirmed'
    AND (OLD.status IS DISTINCT FROM NEW.status)
  ) THEN
    RETURN NEW;
  END IF;

  v_event_key := 'payment_receipt_' || NEW.id::text;

  SELECT * INTO v_invoice
  FROM public.billing_invoices
  WHERE id = NEW.invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
    INTO v_confirmed_total
  FROM public.billing_payments
  WHERE invoice_id = NEW.invoice_id
    AND lower(COALESCE(status::text, '')) IN ('confirmed','paid','completed','captured','succeeded');

  v_balance_due := GREATEST(0, COALESCE(v_invoice.total, 0) - COALESCE(v_confirmed_total, 0));
  v_is_fully_paid := v_balance_due <= 0.01;

  UPDATE public.billing_invoices
  SET
    amount_paid = ROUND(COALESCE(v_confirmed_total, 0)::numeric, 2),
    balance_due = ROUND(v_balance_due::numeric, 2),
    status = CASE
      WHEN v_is_fully_paid THEN 'paid'::public.billing_invoice_status
      ELSE 'partially_paid'::public.billing_invoice_status
    END,
    paid_at = CASE WHEN v_is_fully_paid THEN COALESCE(paid_at, COALESCE(NEW.received_at, now())) ELSE paid_at END,
    payment_method = COALESCE(payment_method, NEW.method)
  WHERE id = NEW.invoice_id;

  IF v_invoice.order_id IS NOT NULL THEN
    UPDATE public.orders
    SET
      payment_status = CASE WHEN v_is_fully_paid THEN 'paid' ELSE COALESCE(NULLIF(payment_status, ''), 'partial') END,
      payment_confirmed_at = CASE WHEN v_is_fully_paid THEN COALESCE(payment_confirmed_at, COALESCE(NEW.received_at, now())) ELSE payment_confirmed_at END,
      payment_reference = COALESCE(NULLIF(payment_reference, ''), NULLIF(NEW.reference, ''), NULLIF(NEW.provider_payment_id, '')),
      status = CASE WHEN v_is_fully_paid AND lower(COALESCE(status::text, '')) = 'pending_payment' THEN 'confirmed' ELSE status END,
      updated_at = now()
    WHERE id = v_invoice.order_id;

    SELECT * INTO v_order
    FROM public.orders
    WHERE id = v_invoice.order_id;
  END IF;

  SELECT bc.email, trim(concat_ws(' ', bc.first_name, bc.last_name))
  INTO v_client_email, v_client_name
  FROM public.billing_customers bc
  WHERE bc.id = NEW.customer_id;

  v_client_email := COALESCE(NULLIF(v_client_email, ''), NULLIF(v_order.client_email, ''));
  v_client_name := COALESCE(NULLIF(v_client_name, ''), NULLIF(trim(concat_ws(' ', v_order.client_first_name, v_order.client_last_name)), ''), 'Client');

  IF v_client_email IS NOT NULL AND v_client_email <> '' THEN
    PERFORM public.rpc_communication_enqueue(
      p_channel => 'email',
      p_template_key => 'payment_receipt',
      p_recipient => v_client_email,
      p_template_vars => jsonb_build_object(
        'order_id', COALESCE(v_invoice.order_id::text, ''),
        'client_name', v_client_name,
        'CLIENT_FIRST_NAME', split_part(v_client_name, ' ', 1),
        'CLIENT_FULL_NAME', v_client_name,
        'invoice_id', NEW.invoice_id,
        'invoice_number', COALESCE(v_invoice.invoice_number, ''),
        'INVOICE_NUMBER', COALESCE(v_invoice.invoice_number, ''),
        'order_number', COALESCE(v_order.order_number, ''),
        'ORDER_NUMBER', COALESCE(v_order.order_number, ''),
        'amount_paid', NEW.amount,
        'AMOUNT', NEW.amount::text,
        'payment_method', NEW.method,
        'PAYMENT_METHOD', NEW.method::text,
        'payment_reference', COALESCE(NEW.reference, NEW.provider_payment_id, ''),
        'paid_at', COALESCE(NEW.received_at::text, now()::text),
        'PAYMENT_DATE', to_char(COALESCE(NEW.received_at, now()), 'YYYY-MM-DD'),
        'status', 'confirmed'
      ),
      p_idempotency_key => v_event_key,
      p_category => 'billing',
      p_entity_type => CASE WHEN v_invoice.order_id IS NOT NULL THEN 'order' ELSE 'invoice' END,
      p_entity_id => COALESCE(v_invoice.order_id::text, NEW.invoice_id::text),
      p_reason => 'Confirmed payment receipt',
      p_subject => 'Reçu de paiement — Nivra'
    );
  END IF;

  RETURN NEW;
END;
$function$;

WITH confirmed AS (
  SELECT
    bp.invoice_id,
    ROUND(COALESCE(SUM(bp.amount), 0)::numeric, 2) AS confirmed_total,
    MAX(bp.received_at) AS last_received_at
  FROM public.billing_payments bp
  WHERE lower(COALESCE(bp.status::text, '')) IN ('confirmed','paid','completed','captured','succeeded')
    AND bp.invoice_id IS NOT NULL
  GROUP BY bp.invoice_id
), reconciled AS (
  UPDATE public.billing_invoices bi
  SET
    amount_paid = confirmed.confirmed_total,
    balance_due = ROUND(GREATEST(0, COALESCE(bi.total, 0) - confirmed.confirmed_total)::numeric, 2),
    status = CASE
      WHEN GREATEST(0, COALESCE(bi.total, 0) - confirmed.confirmed_total) <= 0.01 THEN 'paid'::public.billing_invoice_status
      WHEN confirmed.confirmed_total > 0 THEN 'partially_paid'::public.billing_invoice_status
      ELSE bi.status
    END,
    paid_at = CASE
      WHEN GREATEST(0, COALESCE(bi.total, 0) - confirmed.confirmed_total) <= 0.01 THEN COALESCE(bi.paid_at, confirmed.last_received_at, now())
      ELSE bi.paid_at
    END
  FROM confirmed
  WHERE bi.id = confirmed.invoice_id
    AND (
      COALESCE(bi.amount_paid, 0) IS DISTINCT FROM confirmed.confirmed_total
      OR COALESCE(bi.balance_due, COALESCE(bi.total, 0)) IS DISTINCT FROM ROUND(GREATEST(0, COALESCE(bi.total, 0) - confirmed.confirmed_total)::numeric, 2)
      OR bi.status IS DISTINCT FROM CASE
        WHEN GREATEST(0, COALESCE(bi.total, 0) - confirmed.confirmed_total) <= 0.01 THEN 'paid'::public.billing_invoice_status
        WHEN confirmed.confirmed_total > 0 THEN 'partially_paid'::public.billing_invoice_status
        ELSE bi.status
      END
    )
  RETURNING bi.id, bi.order_id, bi.status, bi.balance_due, bi.paid_at
)
UPDATE public.orders o
SET
  payment_status = CASE WHEN r.status = 'paid'::public.billing_invoice_status THEN 'paid' ELSE COALESCE(NULLIF(o.payment_status, ''), 'partial') END,
  payment_confirmed_at = CASE WHEN r.status = 'paid'::public.billing_invoice_status THEN COALESCE(o.payment_confirmed_at, r.paid_at, now()) ELSE o.payment_confirmed_at END,
  status = CASE WHEN r.status = 'paid'::public.billing_invoice_status AND lower(COALESCE(o.status::text, '')) = 'pending_payment' THEN 'confirmed' ELSE o.status END,
  updated_at = now()
FROM reconciled r
WHERE o.id = r.order_id;
