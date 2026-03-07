-- Allow canonical payment sources used by admin/portal runtime payment flows
ALTER TABLE public.billing_payments
DROP CONSTRAINT IF EXISTS chk_billing_payments_source_valid;

ALTER TABLE public.billing_payments
ADD CONSTRAINT chk_billing_payments_source_valid
CHECK (
  source = ANY (
    ARRAY[
      'live'::text,
      'legacy_migration'::text,
      'test'::text,
      'manual_correction'::text,
      'admin'::text,
      'admin_confirm'::text,
      'admin_manual_confirmation'::text,
      'portal'::text,
      'paypal_capture'::text,
      'paypal_webhook'::text
    ]
  )
);