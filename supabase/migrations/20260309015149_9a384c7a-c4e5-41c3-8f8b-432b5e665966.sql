
-- Add payment_number column to billing_payments
ALTER TABLE public.billing_payments
  ADD COLUMN IF NOT EXISTS payment_number TEXT;

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS billing_payments_payment_number_unique
  ON public.billing_payments (payment_number);

-- Trigger: auto-generate payment_number on INSERT (10-digit, starts 2-9)
CREATE OR REPLACE FUNCTION public.trg_generate_payment_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
BEGIN
  IF NEW.payment_number IS NULL OR NEW.payment_number !~ '^[2-9][0-9]{9}$' THEN
    LOOP
      new_number := generate_secure_numeric_id(10);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM billing_payments WHERE payment_number = new_number);
    END LOOP;
    NEW.payment_number := new_number;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_payments_payment_number ON public.billing_payments;
CREATE TRIGGER trg_billing_payments_payment_number
  BEFORE INSERT ON public.billing_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_generate_payment_number();

-- Backfill existing rows that have NULL payment_number
DO $$
DECLARE
  rec RECORD;
  new_number TEXT;
BEGIN
  FOR rec IN SELECT id FROM billing_payments WHERE payment_number IS NULL LOOP
    LOOP
      new_number := generate_secure_numeric_id(10);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM billing_payments WHERE payment_number = new_number);
    END LOOP;
    UPDATE billing_payments SET payment_number = new_number WHERE id = rec.id;
  END LOOP;
END;
$$;

-- Now make it NOT NULL after backfill
ALTER TABLE public.billing_payments
  ALTER COLUMN payment_number SET NOT NULL;
