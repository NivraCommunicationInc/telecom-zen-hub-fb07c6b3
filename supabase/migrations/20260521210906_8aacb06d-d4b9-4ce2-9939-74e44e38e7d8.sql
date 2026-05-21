DO $$
BEGIN
  ALTER TYPE public.billing_payment_status ADD VALUE IF NOT EXISTS 'completed';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.normalize_billing_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.status::text = 'completed' THEN
    NEW.status := 'confirmed'::public.billing_payment_status;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS aaa_normalize_billing_payment_status ON public.billing_payments;

CREATE TRIGGER aaa_normalize_billing_payment_status
BEFORE INSERT OR UPDATE OF status ON public.billing_payments
FOR EACH ROW
EXECUTE FUNCTION public.normalize_billing_payment_status();