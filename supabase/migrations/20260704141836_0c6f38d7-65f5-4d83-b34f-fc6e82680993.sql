
ALTER TABLE public.billing_customers
  ADD COLUMN IF NOT EXISTS square_card_brand text,
  ADD COLUMN IF NOT EXISTS square_card_last4 text,
  ADD COLUMN IF NOT EXISTS square_card_exp_month int,
  ADD COLUMN IF NOT EXISTS square_card_exp_year int;

ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS autopay_grace_until timestamptz;

COMMENT ON COLUMN public.billing_invoices.autopay_grace_until IS 'Set when Square autopay charge fails on renewal. Dunning must not fire before this date.';
