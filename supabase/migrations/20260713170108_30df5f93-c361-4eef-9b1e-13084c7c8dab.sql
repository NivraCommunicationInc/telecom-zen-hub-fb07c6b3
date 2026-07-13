-- Fix guard: allow official order documents (including payment_receipt)
-- when we have direct evidence of a confirmed payment or a paid invoice,
-- even if the mirrored orders.payment_status hasn't been flipped yet.
-- Previous OR condition raised even when a payment was clearly confirmed.
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

  -- Allow when EITHER order.payment_status is paid OR we have direct
  -- payment/invoice evidence. Only block when BOTH signals are missing.
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
$$;