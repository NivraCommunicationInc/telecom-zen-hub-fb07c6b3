-- Drop check constraint blocking NULL on client_dob
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_client_dob_not_null_check;

-- Drop DOB trigger from orders only
DROP TRIGGER IF EXISTS trg_orders_validate_dob ON public.orders;

-- Add failure_reason column
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS failure_reason text;

-- Update provisioning guard with failure_reason
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
        NEW.id::text,
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

-- NULL out PII data
UPDATE public.orders SET client_dob = NULL, identity_snapshot = NULL WHERE client_dob IS NOT NULL OR identity_snapshot IS NOT NULL;

-- Drop PII columns
ALTER TABLE public.orders DROP COLUMN IF EXISTS client_dob;
ALTER TABLE public.orders DROP COLUMN IF EXISTS identity_snapshot;