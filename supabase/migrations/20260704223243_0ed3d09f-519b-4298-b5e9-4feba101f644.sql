CREATE OR REPLACE FUNCTION public.guard_official_order_documents_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_order public.orders%ROWTYPE;
  v_invoice record;
  v_has_confirmed_payment boolean := false;
  v_is_official_document_email boolean := false;
BEGIN
  IF lower(COALESCE(NEW.status::text, '')) IN ('dlq','failed') THEN
    RETURN NEW;
  END IF;

  v_is_official_document_email :=
    COALESCE(NEW.template_key, '') IN (
      'order_confirmation',
      'document_contract_sent',
      'document_invoice_sent',
      'document_summary_sent',
      'document_receipt_sent',
      'all_documents_sent',
      'payment_receipt',
      'payment_confirmed',
      'service_activated'
    )
    OR COALESCE(NEW.message_type, '') IN (
      'order_confirmation',
      'order_confirmed',
      'payment_receipt',
      'payment_confirmed'
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
     OR NOT (
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
$$;

DROP TRIGGER IF EXISTS guard_official_order_documents_paid_on_email_queue ON public.email_queue;
CREATE TRIGGER guard_official_order_documents_paid_on_email_queue
  BEFORE INSERT OR UPDATE OF status, template_key, message_type, entity_id, entity_type, attachments, template_vars
  ON public.email_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_official_order_documents_paid();

DELETE FROM public.client_auto_documents cad
USING public.orders o
WHERE cad.event_type = 'order_confirmation'
  AND (cad.metadata->>'order_id')::uuid = o.id
  AND lower(COALESCE(o.payment_status, '')) NOT IN ('paid','confirmed','completed','captured','succeeded');

UPDATE public.email_queue eq
SET status = 'dlq',
    last_error = 'Blocked: official order documents require confirmed payment'
FROM public.orders o
WHERE eq.entity_type = 'order'
  AND eq.entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND eq.entity_id::uuid = o.id
  AND lower(COALESCE(o.payment_status, '')) NOT IN ('paid','confirmed','completed','captured','succeeded')
  AND (
    COALESCE(eq.template_key, '') IN ('order_confirmation','document_contract_sent','document_invoice_sent','document_summary_sent','document_receipt_sent','all_documents_sent','payment_receipt','payment_confirmed','service_activated')
    OR COALESCE(eq.event_key, '') LIKE 'manual_document_%'
    OR COALESCE(eq.event_key, '') LIKE 'order_confirmation_%'
  );

UPDATE public.orders o
SET confirmation_email_sent_at = NULL
WHERE confirmation_email_sent_at IS NOT NULL
  AND lower(COALESCE(payment_status, '')) NOT IN ('paid','confirmed','completed','captured','succeeded');