CREATE OR REPLACE FUNCTION public.fn_guard_provisioning_requires_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invoice_exists boolean;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT EXISTS(
      SELECT 1 FROM public.billing_invoices
      WHERE order_id = NEW.id
        AND status NOT IN ('void','cancelled')
    ) INTO invoice_exists;

    IF NOT invoice_exists THEN
      NEW.status := 'provisioning_failed';
      NEW.failure_reason := 'REQUIRES_INVOICE';
      INSERT INTO public.billing_system_alerts (alert_type, entity_type, entity_id, details)
      VALUES (
        'provisioning_blocked_no_invoice',
        'order',
        NEW.id,
        jsonb_build_object(
          'order_number', NEW.order_number,
          'failure_reason', 'REQUIRES_INVOICE',
          'reason', 'No valid invoice found. Completion blocked.',
          'timestamp', now()
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;