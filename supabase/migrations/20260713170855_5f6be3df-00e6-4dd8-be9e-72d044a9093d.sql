CREATE OR REPLACE FUNCTION public.admin_promote_order_to_confirmed(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
    OR public.has_role(auth.uid(), 'supervisor')
    OR public.has_role(auth.uid(), 'billing_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF lower(COALESCE(v_order.status::text, '')) IN ('submitted','pending_admin_review','confirmed','completed','activated','delivered') THEN
    RETURN jsonb_build_object('ok', true, 'already_billable', true, 'status', v_order.status, 'payment_status', v_order.payment_status);
  END IF;

  UPDATE public.orders
  SET
    status = 'confirmed',
    updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.order_status_history (
    order_id,
    status_domain,
    old_status,
    new_status,
    actor_user_id,
    actor_role,
    actor_name,
    change_reason,
    metadata
  ) VALUES (
    p_order_id,
    'order',
    v_order.status,
    'confirmed',
    auth.uid(),
    'admin',
    'Nivra Core',
    'Déblocage administratif pour permettre la confirmation du paiement',
    jsonb_build_object('payment_status_preserved', v_order.payment_status)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'status', 'confirmed',
    'payment_status', v_order.payment_status
  );
END;
$function$;

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
    status = CASE WHEN v_is_fully_paid THEN 'paid' ELSE 'partially_paid' END,
    paid_at = CASE WHEN v_is_fully_paid THEN COALESCE(paid_at, COALESCE(NEW.received_at, now())) ELSE paid_at END,
    payment_method = COALESCE(payment_method, NEW.method),
    updated_at = now()
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

CREATE OR REPLACE FUNCTION public.guard_official_order_documents_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_order public.orders%ROWTYPE;
  v_invoice record;
  v_payment_id uuid;
  v_has_confirmed_payment boolean := false;
  v_is_official_document_email boolean := false;
BEGIN
  IF lower(COALESCE(NEW.status::text, '')) IN ('dlq','failed') THEN
    RETURN NEW;
  END IF;

  v_is_official_document_email :=
    COALESCE(NEW.template_key, '') IN (
      'order_confirmation','document_contract_sent','document_invoice_sent',
      'document_summary_sent','document_receipt_sent','all_documents_sent',
      'payment_receipt','payment_confirmed','service_activated'
    )
    OR COALESCE(NEW.message_type, '') IN (
      'order_confirmation','order_confirmed','payment_receipt','payment_confirmed'
    )
    OR COALESCE(NEW.event_key, '') LIKE 'manual_document_%'
    OR COALESCE(NEW.event_key, '') LIKE 'order_confirmation_%'
    OR COALESCE(NEW.attachments::text, '') LIKE '%order_contract%'
    OR COALESCE(NEW.attachments::text, '') LIKE '%order_invoice%'
    OR COALESCE(NEW.attachments::text, '') LIKE '%order_summary%'
    OR COALESCE(NEW.attachments::text, '') LIKE '%receipt%'
    OR COALESCE(NEW.attachments::text, '') LIKE '%recu%';

  IF NOT v_is_official_document_email THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.entity_type, '') = 'order' AND NEW.entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_order_id := NEW.entity_id::uuid;
  ELSIF NEW.template_vars ? 'order_id' AND (NEW.template_vars->>'order_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_order_id := (NEW.template_vars->>'order_id')::uuid;
  ELSIF COALESCE(NEW.event_key, '') ~ '^payment_receipt_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_payment_id := substring(NEW.event_key from 'payment_receipt_([0-9a-f-]{36})')::uuid;
    SELECT bi.order_id INTO v_order_id
    FROM public.billing_payments bp
    JOIN public.billing_invoices bi ON bi.id = bp.invoice_id
    WHERE bp.id = v_payment_id;
  ELSE
    RETURN NEW;
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_order_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT id, status::text AS status, total, amount_paid, balance_due
    INTO v_invoice
  FROM public.billing_invoices
  WHERE order_id = v_order_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invoice.id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.billing_payments p
      WHERE p.invoice_id = v_invoice.id
        AND lower(COALESCE(p.status::text, '')) IN ('paid','confirmed','completed','captured','succeeded')
        AND COALESCE(p.amount, 0) > 0
    ) INTO v_has_confirmed_payment;
  END IF;

  IF lower(COALESCE(v_order.payment_status, '')) NOT IN ('paid','confirmed','completed','captured','succeeded')
     AND NOT (
       v_has_confirmed_payment
       OR (
         lower(COALESCE(v_invoice.status, '')) IN ('paid','confirmed','completed','captured','succeeded')
         AND COALESCE(v_invoice.balance_due, 999999) <= 0.01
       )
     ) THEN
    RAISE EXCEPTION 'official_order_documents_blocked_until_payment_confirmed order_id=% payment_status=% template_key=%',
      v_order_id, COALESCE(v_order.payment_status, 'missing'), COALESCE(NEW.template_key, 'missing')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;