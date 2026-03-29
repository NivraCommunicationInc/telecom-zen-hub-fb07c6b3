
-- P0-1 FINAL FIX: Extend provisioning guard to cover ALL completion states
-- ROOT CAUSE: fn_guard_provisioning_requires_invoice only guarded 'completed' and 'installation_completed'
-- but NOT 'activated' or 'delivered', allowing orders to reach operational states without payment.

CREATE OR REPLACE FUNCTION public.fn_guard_provisioning_requires_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice record;
  v_alert_reason text;
  completion_states text[] := ARRAY['completed', 'installation_completed', 'activated', 'delivered'];
BEGIN
  -- Only guard transitions INTO completion/operational states
  IF NEW.status != ALL(completion_states) THEN
    RETURN NEW;
  END IF;
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Check for a valid, non-void invoice
  SELECT id, status, balance_due, total
  INTO v_invoice
  FROM public.billing_invoices
  WHERE order_id = NEW.id
    AND status NOT IN ('void', 'cancelled')
  ORDER BY created_at DESC
  LIMIT 1;

  -- RULE 1: Invoice must exist
  IF v_invoice IS NULL THEN
    v_alert_reason := 'REQUIRES_INVOICE';
    NEW.status := 'provisioning_failed';
    NEW.failure_reason := v_alert_reason;

    INSERT INTO public.billing_system_alerts (alert_type, entity_type, entity_id, details)
    VALUES (
      'provisioning_blocked_no_invoice',
      'order',
      NEW.id,
      jsonb_build_object(
        'order_number', NEW.order_number,
        'failure_reason', v_alert_reason,
        'reason', 'No valid invoice found. Activation blocked.',
        'attempted_status', NEW.status,
        'timestamp', now()
      )
    );
    RETURN NEW;
  END IF;

  -- RULE 2: Invoice must be paid (balance_due = 0 or status in paid/partially_paid)
  IF v_invoice.status NOT IN ('paid', 'partially_paid') AND COALESCE(v_invoice.balance_due, v_invoice.total) > 0 THEN
    v_alert_reason := 'REQUIRES_PAYMENT';
    NEW.status := 'provisioning_failed';
    NEW.failure_reason := v_alert_reason;

    INSERT INTO public.billing_system_alerts (alert_type, entity_type, entity_id, details)
    VALUES (
      'provisioning_blocked_unpaid',
      'order',
      NEW.id,
      jsonb_build_object(
        'order_number', NEW.order_number,
        'failure_reason', v_alert_reason,
        'invoice_id', v_invoice.id,
        'invoice_status', v_invoice.status,
        'balance_due', v_invoice.balance_due,
        'reason', 'Invoice exists but is not paid. Activation blocked.',
        'attempted_status', NEW.status,
        'timestamp', now()
      )
    );
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;
