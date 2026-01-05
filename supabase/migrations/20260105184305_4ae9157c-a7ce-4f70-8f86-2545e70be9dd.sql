-- Add missing columns for ManualOrderWizard

-- 1) Add payment_method column
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_method TEXT NULL;

-- 2) Add sim_type column
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS sim_type TEXT NULL;

-- 3) Add CHECK constraint for payment_method
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_payment_method_check'
  ) THEN
    ALTER TABLE public.orders
    ADD CONSTRAINT orders_payment_method_check
    CHECK (
      payment_method IS NULL OR payment_method IN (
        'card', 'etransfer', 'e_transfer', 'apple_pay', 'google_pay'
      )
    );
  END IF;
END $$;

-- 4) Add CHECK constraint for sim_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_sim_type_check'
  ) THEN
    ALTER TABLE public.orders
    ADD CONSTRAINT orders_sim_type_check
    CHECK (
      sim_type IS NULL OR sim_type IN ('esim', 'physical')
    );
  END IF;
END $$;

-- 5) Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';