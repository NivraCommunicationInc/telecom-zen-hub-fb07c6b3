
-- 1. Add checkout_status to quotes for the new acceptance flow
ALTER TABLE public.quotes 
  ADD COLUMN IF NOT EXISTS checkout_status TEXT DEFAULT 'not_started' CHECK (checkout_status IN ('not_started', 'in_progress', 'completed')),
  ADD COLUMN IF NOT EXISTS checkout_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkout_token TEXT UNIQUE;

-- 2. Create account_promotions table for duration-based discounts
CREATE TABLE IF NOT EXISTS public.account_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  customer_id UUID,
  quote_id UUID,
  order_id UUID,
  promo_code TEXT,
  label TEXT NOT NULL,
  promotion_type TEXT NOT NULL CHECK (promotion_type IN ('monthly_discount', 'credit', 'promo')),
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_months INTEGER NOT NULL DEFAULT 1,
  months_remaining INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by_user_id UUID,
  created_by_role TEXT,
  notes TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.account_promotions ENABLE ROW LEVEL SECURITY;

-- RLS: staff can manage promotions
CREATE POLICY "Staff can manage promotions" ON public.account_promotions
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'employee')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'employee')
  );

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_account_promotions_account ON public.account_promotions(account_id);
CREATE INDEX IF NOT EXISTS idx_account_promotions_active ON public.account_promotions(is_active, months_remaining);
CREATE INDEX IF NOT EXISTS idx_quotes_checkout_token ON public.quotes(checkout_token);
