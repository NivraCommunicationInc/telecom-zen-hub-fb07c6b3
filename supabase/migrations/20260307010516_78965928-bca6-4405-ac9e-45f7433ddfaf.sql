-- Prevent duplicate/invalid payment transitions on invoice paid
-- Canonical payment status changes are handled by apply_payment_to_invoice.
CREATE OR REPLACE FUNCTION public.billing_invoice_paid_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    -- Keep subscription sync behavior
    UPDATE public.billing_subscriptions
    SET 
      status = 'active',
      last_invoice_id = NEW.id,
      cycle_start_date = NEW.cycle_start_date,
      cycle_end_date = NEW.cycle_end_date,
      updated_at = now()
    WHERE id = NEW.subscription_id;

    -- IMPORTANT: do NOT auto-confirm pending billing_payments here.
    -- Payment confirmation is exclusively handled by apply_payment_to_invoice
    -- to avoid duplicate confirmations and constraint failures.
  END IF;

  RETURN NEW;
END;
$function$;