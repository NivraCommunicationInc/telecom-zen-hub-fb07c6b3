-- 1) Add the missing column
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS etransfer_status TEXT NULL;

-- 2) Add CHECK constraint for valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_etransfer_status_check'
  ) THEN
    ALTER TABLE public.orders
    ADD CONSTRAINT orders_etransfer_status_check
    CHECK (
      etransfer_status IS NULL OR etransfer_status IN (
        'Pending', 'In verification', 'Complete', 'Declined', 'Fraud'
      )
    );
  END IF;
END $$;

-- 3) Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';