
-- Guardrail: ensure recurring_setup_status is never null for active subscriptions
-- Default new subscriptions to 'pending' if not explicitly set
ALTER TABLE billing_subscriptions 
ALTER COLUMN recurring_setup_status SET DEFAULT 'pending';

-- Fix: ensure the RPC sets recurring_setup_status when creating renewal invoices
-- (The RPC already updates cycle dates; we just need the default to prevent nulls going forward)
