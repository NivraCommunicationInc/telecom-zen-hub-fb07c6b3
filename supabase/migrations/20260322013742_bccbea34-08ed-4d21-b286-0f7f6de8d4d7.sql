
-- ============================================================
-- FIX: Queue reactivation email when subscription goes suspended → active
-- This fires when apply_payment_to_invoice reactivates a suspended sub
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_queue_reactivation_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer RECORD;
  v_idempotency_key TEXT;
BEGIN
  -- Only fire on suspended → active transition
  IF OLD.status = 'suspended' AND NEW.status = 'active' THEN
    -- Get customer email
    SELECT email, first_name, last_name
    INTO v_customer
    FROM billing_customers
    WHERE id = NEW.customer_id;

    IF v_customer.email IS NOT NULL THEN
      v_idempotency_key := 'reactivation_' || NEW.id || '_' || NOW()::date::text;

      -- Check idempotency
      IF NOT EXISTS (
        SELECT 1 FROM email_queue
        WHERE event_key = v_idempotency_key
          AND status IN ('queued', 'sent', 'processing')
      ) THEN
        INSERT INTO email_queue (
          event_key, idempotency_key, to_email, from_email,
          subject, template_key, template_vars,
          status, attempts, max_attempts
        ) VALUES (
          v_idempotency_key, v_idempotency_key,
          v_customer.email,
          'Nivra Telecom <support@nivra-telecom.ca>',
          'Nivra — Service rétabli ✅',
          'service_reactivated',
          jsonb_build_object(
            'client_name', COALESCE(v_customer.first_name, '') || ' ' || COALESCE(v_customer.last_name, ''),
            'plan_name', NEW.plan_name,
            'reactivation_date', NOW()::date::text,
            'payment_link', 'https://nivra-telecom.ca/portail/facturation'
          ),
          'queued', 0, 3
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sub_reactivation_email ON public.billing_subscriptions;
CREATE TRIGGER trg_sub_reactivation_email
  AFTER UPDATE OF status ON public.billing_subscriptions
  FOR EACH ROW
  WHEN (OLD.status = 'suspended' AND NEW.status = 'active')
  EXECUTE FUNCTION public.trg_queue_reactivation_email();
