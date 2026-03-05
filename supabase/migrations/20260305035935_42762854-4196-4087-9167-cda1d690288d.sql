
-- Update protect_subscription_activation to also accept:
-- 1) Paid invoices linked to the subscription
-- 2) Paid invoices linked to the ORDER that the subscription serves (via plan_code = 'order-XXXXX')
-- 3) Orders with payment_status = 'authorized' and total_amount = 0 (promo_free)
CREATE OR REPLACE FUNCTION public.protect_subscription_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_paid_invoice BOOLEAN := FALSE;
  has_paid_order BOOLEAN := FALSE;
  v_order_number TEXT;
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    
    -- Check 1: paid invoice linked directly to subscription
    SELECT EXISTS (
      SELECT 1 FROM billing_invoices bi
      WHERE bi.subscription_id = NEW.id AND bi.status = 'paid'
    ) INTO has_paid_invoice;
    
    -- Check 2: if plan_code starts with 'order-', check if that order is paid or promo_free
    IF NOT has_paid_invoice AND NEW.plan_code LIKE 'order-%' THEN
      v_order_number := substring(NEW.plan_code from 7);
      SELECT EXISTS (
        SELECT 1 FROM orders o
        WHERE o.order_number = v_order_number
        AND (
          o.payment_status IN ('paid', 'authorized')
          OR o.total_amount = 0
        )
      ) INTO has_paid_order;
    END IF;
    
    IF NOT has_paid_invoice AND NOT has_paid_order THEN
      INSERT INTO billing_system_alerts (
        alert_type, entity_type, entity_id, details
      ) VALUES (
        'ACTIVATION_WITHOUT_PAYMENT', 'billing_subscriptions', NEW.id,
        jsonb_build_object(
          'customer_id', NEW.customer_id,
          'plan_code', NEW.plan_code,
          'plan_name', NEW.plan_name,
          'attempted_at', NOW(),
          'message', 'CRITICAL: Attempted to activate subscription without confirmed payment'
        )
      );
      RAISE WARNING '[BILLING V2] BLOCKED: Cannot activate subscription % without paid invoice or paid order. Reverting to pending.', NEW.id;
      NEW.status := 'pending';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Now activate the subscription for order 64872 (promo_free, $0 total, authorized)
UPDATE billing_subscriptions 
SET status = 'active'::billing_subscription_status, updated_at = NOW()
WHERE id = 'a8df05ea-b270-4a2c-936f-a782a0de927f';
