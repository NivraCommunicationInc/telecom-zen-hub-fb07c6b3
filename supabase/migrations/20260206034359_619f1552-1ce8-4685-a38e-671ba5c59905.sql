-- ============================================================================
-- FIX: Prevent negative totals and taxes in orders table
-- This ensures discount_amount can never exceed the gross amount
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_order_total()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  base_amount NUMERIC;
  installation_final NUMERIC;
  capped_discount NUMERIC;
  gross_before_discount NUMERIC;
BEGIN
  -- Calculate installation fee after credit
  installation_final := GREATEST(0, COALESCE(NEW.installation_fee, 0) - COALESCE(NEW.installation_credit, 0));
  
  -- Calculate gross amount BEFORE discount (to cap the discount)
  gross_before_discount := COALESCE(NEW.subtotal, 0) 
    + COALESCE(NEW.delivery_fee, 30) 
    + COALESCE(NEW.activation_fee, 25) 
    + installation_final;
  
  -- CAP DISCOUNT: Never allow discount to exceed gross amount (prevents negative)
  capped_discount := LEAST(COALESCE(NEW.discount_amount, 0), gross_before_discount);
  
  -- If discount was capped, update it in the record
  IF capped_discount <> COALESCE(NEW.discount_amount, 0) THEN
    NEW.discount_amount := capped_discount;
  END IF;
  
  -- Base amount (subtotal + fees - capped discount)
  base_amount := GREATEST(0, gross_before_discount - capped_discount);
  
  -- Calculate taxes (Quebec TPS 5% + TVQ 9.975%) - only on positive base
  NEW.tps_amount := ROUND(base_amount * 0.05, 2);
  NEW.tvq_amount := ROUND(base_amount * 0.09975, 2);
  
  -- Calculate total amount - NEVER negative
  NEW.total_amount := GREATEST(0, base_amount + NEW.tps_amount + NEW.tvq_amount + COALESCE(NEW.late_fee_amount, 0) - COALESCE(NEW.credits_applied, 0));
  
  RETURN NEW;
END;
$function$;

-- Add comment explaining the capping behavior
COMMENT ON FUNCTION public.calculate_order_total() IS 'Calculates order totals with automatic discount capping to prevent negative amounts. V2.1 - Added GREATEST(0, ...) guards and discount capping.';