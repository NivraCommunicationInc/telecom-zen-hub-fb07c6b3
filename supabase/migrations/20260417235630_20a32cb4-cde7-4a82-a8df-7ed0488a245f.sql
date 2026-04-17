-- ============================================================
-- B4: Performance indexes for high-traffic launch
-- ============================================================

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_client_email_lower ON public.orders (lower(client_email));

-- Billing invoices
CREATE INDEX IF NOT EXISTS idx_billing_invoices_status_due ON public.billing_invoices (status, due_date) 
  WHERE status IN ('pending', 'overdue');

-- Billing customers
CREATE INDEX IF NOT EXISTS idx_billing_customers_email_lower ON public.billing_customers (lower(email));

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles (lower(email));

-- Accounts
CREATE INDEX IF NOT EXISTS idx_accounts_next_invoice_date ON public.accounts (next_invoice_date) 
  WHERE next_invoice_date IS NOT NULL;

-- Email queue
CREATE INDEX IF NOT EXISTS idx_email_queue_status_created_v2 ON public.email_queue (status, created_at) 
  WHERE status IN ('queued', 'processing');

-- Activity logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs (entity_type, entity_id, created_at DESC);

-- Billing subscriptions
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_next_renewal ON public.billing_subscriptions (next_renewal_at) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_no_paypal_active ON public.billing_subscriptions (cycle_start_date) 
  WHERE status = 'active' AND paypal_subscription_id IS NULL;

-- ANALYZE
ANALYZE public.orders;
ANALYZE public.billing_invoices;
ANALYZE public.billing_customers;
ANALYZE public.billing_subscriptions;
ANALYZE public.profiles;
ANALYZE public.accounts;
ANALYZE public.email_queue;
ANALYZE public.activity_logs;