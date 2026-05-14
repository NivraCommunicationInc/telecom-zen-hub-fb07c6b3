ALTER TABLE public.field_submissions
  ADD COLUMN IF NOT EXISTS activation_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_price  DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source         TEXT DEFAULT 'field_sales',
  ADD COLUMN IF NOT EXISTS agent_email    TEXT;