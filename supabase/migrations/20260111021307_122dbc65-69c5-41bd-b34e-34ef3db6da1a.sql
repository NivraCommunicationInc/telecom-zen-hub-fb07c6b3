-- Step 1: Add all missing columns to payments table
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS invoice_id uuid,
ADD COLUMN IF NOT EXISTS order_id uuid,
ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS created_by_id uuid,
ADD COLUMN IF NOT EXISTS created_by_name text,
ADD COLUMN IF NOT EXISTS created_by_role text,
ADD COLUMN IF NOT EXISTS provider_payment_id text,
ADD COLUMN IF NOT EXISTS captured_at timestamptz,
ADD COLUMN IF NOT EXISTS error_reason text,
ADD COLUMN IF NOT EXISTS client_id uuid,
ADD COLUMN IF NOT EXISTS account_id uuid;

-- Add foreign keys separately (safer)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_invoice_id_fkey') THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_invoice_id_fkey 
    FOREIGN KEY (invoice_id) REFERENCES public.billing(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_order_id_fkey') THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_order_id_fkey 
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_account_id_fkey') THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_account_id_fkey 
    FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create unique index on provider_payment_id for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_payment_id_unique 
ON public.payments(provider_payment_id) 
WHERE provider_payment_id IS NOT NULL;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON public.payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);