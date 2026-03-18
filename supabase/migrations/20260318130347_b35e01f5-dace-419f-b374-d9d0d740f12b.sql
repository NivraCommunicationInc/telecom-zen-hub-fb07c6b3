
-- Fix: calculate_order_total must not override total_amount for canonical billing orders.
-- When total_amount is explicitly set AND there is a linked billing_invoice, the trigger
-- should respect the canonical invoice total instead of recalculating from legacy columns.
CREATE OR REPLACE FUNCTION calculate_order_total()
RETURNS TRIGGER AS $$
DECLARE
  base_amount NUMERIC;
  installation_final NUMERIC;
  capped_discount NUMERIC;
  gross_before_discount NUMERIC;
  v_invoice_total NUMERIC;
BEGIN
  -- If this order has a linked billing_invoice, the invoice total is the canonical source of truth.
  -- Do NOT recalculate — preserve the value set by checkout-canonical-sync or checkoutFallback.
  IF TG_OP = 'UPDATE' THEN
    SELECT total INTO v_invoice_total
    FROM billing_invoices
    WHERE order_id = NEW.id AND status IN ('paid', 'pending', 'partially_paid')
    LIMIT 1;
    
    IF v_invoice_total IS NOT NULL THEN
      NEW.total_amount := v_invoice_total;
      RETURN NEW;
    END IF;
  END IF;

  -- Legacy calculation for orders without a canonical billing_invoice
  installation_final := GREATEST(0, COALESCE(NEW.installation_fee, 0) - COALESCE(NEW.installation_credit, 0));
  
  gross_before_discount := COALESCE(NEW.subtotal, 0) 
    + COALESCE(NEW.delivery_fee, 30) 
    + COALESCE(NEW.activation_fee, 25) 
    + installation_final;
  
  capped_discount := LEAST(COALESCE(NEW.discount_amount, 0), gross_before_discount);
  
  IF capped_discount <> COALESCE(NEW.discount_amount, 0) THEN
    NEW.discount_amount := capped_discount;
  END IF;
  
  base_amount := GREATEST(0, gross_before_discount - capped_discount);
  
  NEW.tps_amount := ROUND(base_amount * 0.05, 2);
  NEW.tvq_amount := ROUND(base_amount * 0.09975, 2);
  
  NEW.total_amount := GREATEST(0, base_amount + NEW.tps_amount + NEW.tvq_amount + COALESCE(NEW.late_fee_amount, 0) - COALESCE(NEW.credits_applied, 0));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Now fix order #80876 with the corrected trigger in place
UPDATE orders 
SET total_amount = 248.34
WHERE id = 'c692a860-b9cf-46b3-9705-0348ee086460';
