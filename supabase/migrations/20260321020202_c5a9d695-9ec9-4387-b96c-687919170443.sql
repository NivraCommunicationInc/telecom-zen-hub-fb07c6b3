-- Fix billing_customers for order 78446 customer
UPDATE public.billing_customers 
SET stripe_customer_id = 'cus_UBaig8CkQzGuHv'
WHERE id = '9837ca5e-c92a-4015-abac-d59bb33d0d2d' 
  AND stripe_customer_id IS NULL;

-- Create trigger to enforce stripe_setup_status is never NULL after invoice is paid for recurring orders
CREATE OR REPLACE FUNCTION public.enforce_subscription_setup_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_service_type text;
  v_pricing_snapshot jsonb;
  v_is_recurring boolean := false;
  v_sub_id uuid;
  v_current_status text;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    v_order_id := NEW.order_id;
    
    IF v_order_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    SELECT service_type, pricing_snapshot::jsonb 
    INTO v_service_type, v_pricing_snapshot
    FROM public.orders WHERE id = v_order_id;
    
    IF v_service_type IS NOT NULL AND (
      v_service_type ILIKE '%internet%' OR 
      v_service_type ILIKE '%mobile%' OR 
      v_service_type ILIKE '%tv%' OR 
      v_service_type ILIKE '%streaming%' OR 
      v_service_type ILIKE '%security%'
    ) THEN
      v_is_recurring := true;
    END IF;
    
    IF v_pricing_snapshot IS NOT NULL AND (
      v_pricing_snapshot->>'plan_code' IS NOT NULL OR
      v_pricing_snapshot->>'service_category' IN ('internet','mobile','tv_combo','tv_pack','streaming','security')
    ) THEN
      v_is_recurring := true;
    END IF;
    
    IF v_is_recurring THEN
      SELECT id, stripe_setup_status INTO v_sub_id, v_current_status
      FROM public.billing_subscriptions
      WHERE order_id = v_order_id
      LIMIT 1;
      
      IF v_sub_id IS NOT NULL AND v_current_status IS NULL THEN
        UPDATE public.billing_subscriptions
        SET stripe_setup_status = 'pending',
            updated_at = now()
        WHERE id = v_sub_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_subscription_setup_status ON public.billing_invoices;
CREATE TRIGGER trg_enforce_subscription_setup_status
  AFTER UPDATE ON public.billing_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_subscription_setup_status();

-- Fix order 78446 subscription to pending for retry
UPDATE public.billing_subscriptions
SET stripe_setup_status = 'pending',
    updated_at = now()
WHERE order_id = '871ceddc-71df-4e13-accb-61fec56ae908'
  AND stripe_subscription_id IS NULL
  AND (stripe_setup_status IS NULL OR stripe_setup_status = 'pending');