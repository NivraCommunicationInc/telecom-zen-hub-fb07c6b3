
ALTER TABLE public.field_quotes
  ADD COLUMN IF NOT EXISTS install_date date,
  ADD COLUMN IF NOT EXISTS install_mode text DEFAULT 'technician';

ALTER TABLE public.field_quotes
  DROP CONSTRAINT IF EXISTS field_quotes_install_mode_check;
ALTER TABLE public.field_quotes
  ADD CONSTRAINT field_quotes_install_mode_check
  CHECK (install_mode IN ('self','technician'));

ALTER TABLE public.field_payment_intents
  ADD COLUMN IF NOT EXISTS signature jsonb,
  ADD COLUMN IF NOT EXISTS consent_flags jsonb,
  ADD COLUMN IF NOT EXISTS client_edits jsonb;

ALTER TABLE public.field_sales_orders
  ADD COLUMN IF NOT EXISTS install_date date,
  ADD COLUMN IF NOT EXISTS install_mode text;
