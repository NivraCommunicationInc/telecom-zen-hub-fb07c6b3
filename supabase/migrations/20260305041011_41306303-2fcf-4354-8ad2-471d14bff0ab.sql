
-- Fix: protect_subscription_insert_activation must also allow activation 
-- when provisioned from a paid/authorized order
CREATE OR REPLACE FUNCTION public.protect_subscription_insert_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_paid_order BOOLEAN := FALSE;
  v_order_number TEXT;
BEGIN
  IF NEW.status = 'active' THEN
    -- Check if plan_code links to a paid order
    IF NEW.plan_code LIKE 'order-%' THEN
      v_order_number := substring(NEW.plan_code from 7);
      SELECT EXISTS (
        SELECT 1 FROM orders o
        WHERE o.order_number = v_order_number
        AND (o.payment_status IN ('paid', 'authorized', 'captured') OR o.total_amount = 0)
      ) INTO has_paid_order;
    END IF;
    
    IF NOT has_paid_order THEN
      INSERT INTO billing_system_alerts (
        alert_type, entity_type, entity_id, details
      ) VALUES (
        'DIRECT_ACTIVE_INSERT', 'billing_subscriptions', NEW.id,
        jsonb_build_object(
          'customer_id', NEW.customer_id,
          'plan_code', NEW.plan_code,
          'message', 'Attempted to insert subscription with active status without paid order'
        )
      );
      RAISE WARNING '[BILLING V2] BLOCKED: Cannot insert subscription with active status without paid order. Setting to pending.';
      NEW.status := 'pending';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Now activate the 3 test subscriptions that were blocked
UPDATE billing_subscriptions SET status = 'active' WHERE plan_code = 'order-90001';
UPDATE billing_subscriptions SET status = 'active' WHERE plan_code = 'order-90002';
UPDATE billing_subscriptions SET status = 'active' WHERE plan_code = 'order-90003';
