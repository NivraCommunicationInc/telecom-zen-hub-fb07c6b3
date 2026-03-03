
-- Fix notify_payment_received to only use valid enum values
CREATE OR REPLACE FUNCTION public.notify_payment_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_customer RECORD;
  v_invoice RECORD;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    SELECT first_name, last_name, email INTO v_customer
    FROM public.billing_customers WHERE id = NEW.customer_id;

    SELECT invoice_number INTO v_invoice
    FROM public.billing_invoices WHERE id = NEW.invoice_id;

    INSERT INTO public.staff_notifications (
      notification_type, title, message, entity_type, entity_id,
      entity_number, client_name, client_email, amount
    ) VALUES (
      'payment_received', 'Paiement reçu',
      'Paiement de ' || NEW.amount || ' $ reçu de ' || COALESCE(v_customer.first_name, '') || ' ' || COALESCE(v_customer.last_name, '') || ' via ' || UPPER(NEW.method::text),
      'payment', NEW.id, v_invoice.invoice_number,
      COALESCE(v_customer.first_name, '') || ' ' || COALESCE(v_customer.last_name, ''),
      v_customer.email, NEW.amount
    );
  END IF;
  RETURN NEW;
END;
$function$;
