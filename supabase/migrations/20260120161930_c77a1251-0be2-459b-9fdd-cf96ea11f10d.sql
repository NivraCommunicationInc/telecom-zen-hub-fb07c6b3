-- ============================================================
-- BILLING V2 SYSTEM RULES - PROTECTION TRIGGER
-- ============================================================
-- 
-- BUSINESS RULE (PREPAID MODEL - LOCKED):
-- ┌─────────────────────────────────────────────────────────────┐
-- │ THE BILLING CYCLE NEVER STARTS AT ORDER CREATION.          │
-- │ THE CYCLE STARTS ONLY WHEN INTERAC PAYMENT IS CONFIRMED.   │
-- └─────────────────────────────────────────────────────────────┘
--
-- This trigger prevents ANY subscription from becoming 'active'
-- unless a corresponding invoice with status = 'paid' exists.
-- If a violation is detected, it logs an alert and blocks the change.
-- ============================================================

-- Create admin alert table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.billing_system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on alerts (admin only)
ALTER TABLE public.billing_system_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated staff can view alerts
CREATE POLICY "Staff can view billing alerts" 
ON public.billing_system_alerts 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Create protection function
CREATE OR REPLACE FUNCTION public.protect_subscription_activation()
RETURNS TRIGGER AS $$
DECLARE
  has_paid_invoice BOOLEAN := FALSE;
  invoice_record RECORD;
BEGIN
  -- Only check when status is changing TO 'active'
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    
    -- Check if there's a paid invoice for this subscription
    SELECT EXISTS (
      SELECT 1 
      FROM billing_invoices bi
      WHERE bi.subscription_id = NEW.id 
      AND bi.status = 'paid'
    ) INTO has_paid_invoice;
    
    -- If no paid invoice exists, this is a violation
    IF NOT has_paid_invoice THEN
      -- Log the alert
      INSERT INTO billing_system_alerts (
        alert_type,
        entity_type,
        entity_id,
        details
      ) VALUES (
        'ACTIVATION_WITHOUT_PAYMENT',
        'billing_subscriptions',
        NEW.id,
        jsonb_build_object(
          'customer_id', NEW.customer_id,
          'plan_code', NEW.plan_code,
          'plan_name', NEW.plan_name,
          'attempted_at', NOW(),
          'message', 'CRITICAL: Attempted to activate subscription without confirmed Interac payment'
        )
      );
      
      -- Block the activation - revert to pending
      RAISE WARNING '[BILLING V2] BLOCKED: Cannot activate subscription % without paid invoice. Reverting to pending.', NEW.id;
      NEW.status := 'pending';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on billing_subscriptions
DROP TRIGGER IF EXISTS protect_subscription_activation_trigger ON public.billing_subscriptions;

CREATE TRIGGER protect_subscription_activation_trigger
BEFORE UPDATE ON public.billing_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.protect_subscription_activation();

-- Also protect INSERT with active status
CREATE OR REPLACE FUNCTION public.protect_subscription_insert_activation()
RETURNS TRIGGER AS $$
BEGIN
  -- Never allow direct insert with 'active' status
  IF NEW.status = 'active' THEN
    -- Log alert
    INSERT INTO billing_system_alerts (
      alert_type,
      entity_type,
      entity_id,
      details
    ) VALUES (
      'DIRECT_ACTIVE_INSERT',
      'billing_subscriptions',
      NEW.id,
      jsonb_build_object(
        'customer_id', NEW.customer_id,
        'plan_code', NEW.plan_code,
        'message', 'CRITICAL: Attempted to insert subscription with active status directly'
      )
    );
    
    RAISE WARNING '[BILLING V2] BLOCKED: Cannot insert subscription with active status. Setting to pending.';
    NEW.status := 'pending';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS protect_subscription_insert_trigger ON public.billing_subscriptions;

CREATE TRIGGER protect_subscription_insert_trigger
BEFORE INSERT ON public.billing_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.protect_subscription_insert_activation();

-- Add comments to document the system rules
COMMENT ON TABLE public.billing_subscriptions IS 
'Billing V2 Subscriptions. 
SYSTEM RULE: Status can only become "active" via the on_invoice_paid_update_subscription trigger 
when an invoice is marked as paid. Direct activation is blocked by protect_subscription_activation_trigger.
Cycle dates are ALWAYS based on Interac payment confirmation date, NEVER order date.';

COMMENT ON TABLE public.billing_invoices IS 
'Billing V2 Invoices.
SYSTEM RULE: cycle_start_date and cycle_end_date are PROVISIONAL at creation.
When status changes to "paid", the trigger recalculates:
- cycle_start_date = paid_at (exact payment confirmation timestamp)
- cycle_end_date = cycle_start_date + 30 days
All payments are Interac e-Transfer only.';

COMMENT ON FUNCTION public.protect_subscription_activation() IS 
'PROTECTION: Prevents any subscription from becoming active without a confirmed paid invoice. 
Logs violations to billing_system_alerts table.';

COMMENT ON FUNCTION public.update_subscription_on_invoice_paid() IS 
'CORE BUSINESS RULE: When invoice.status becomes "paid", this trigger:
1. Sets subscription.cycle_start_date = invoice.paid_at
2. Sets subscription.cycle_end_date = paid_at + 30 days
3. Sets subscription.status = "active"
This is the ONLY valid way to activate a subscription.';

-- Grant realtime for alerts (admin monitoring)
ALTER PUBLICATION supabase_realtime ADD TABLE public.billing_system_alerts;