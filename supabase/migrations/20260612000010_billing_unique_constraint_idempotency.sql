-- AUDIT FIX B-1: Enforce idempotency at DB level on billing_payments
-- apply_payment_to_invoice already checks provider_payment_id in code,
-- but without a DB constraint a race condition can still insert duplicates.
-- Partial index: only enforce uniqueness when provider_payment_id is set
-- (manual cash payments have NULL, which is fine to allow multiple).

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_payments_provider_payment_id_unique
  ON public.billing_payments (provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

-- Also ensure provider_order_id is tracked for order-level dedup
CREATE INDEX IF NOT EXISTS idx_billing_payments_provider_order_id
  ON public.billing_payments (provider_order_id)
  WHERE provider_order_id IS NOT NULL;
