-- Add environment column to all transactional tables
-- Default 'live' so all future records are production by default

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'live';
ALTER TABLE public.billing_invoices ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'live';
ALTER TABLE public.billing_payments ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'live';
ALTER TABLE public.billing_subscriptions ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'live';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'live';
ALTER TABLE public.billing ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'live';

-- Add indexes for filtering performance
CREATE INDEX IF NOT EXISTS idx_orders_environment ON public.orders(environment);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_environment ON public.billing_invoices(environment);
CREATE INDEX IF NOT EXISTS idx_billing_payments_environment ON public.billing_payments(environment);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_environment ON public.billing_subscriptions(environment);
CREATE INDEX IF NOT EXISTS idx_appointments_environment ON public.appointments(environment);
CREATE INDEX IF NOT EXISTS idx_billing_environment ON public.billing(environment);