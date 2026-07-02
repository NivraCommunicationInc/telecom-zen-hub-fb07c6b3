
-- Allow 'public_pay' as a valid billing_payments.source
ALTER TABLE public.billing_payments DROP CONSTRAINT IF EXISTS chk_billing_payments_source_valid;
ALTER TABLE public.billing_payments ADD CONSTRAINT chk_billing_payments_source_valid
  CHECK (source = ANY (ARRAY[
    'live','legacy_migration','test','manual_correction','admin','admin_confirm',
    'admin_manual_confirmation','portal','paypal_capture','paypal_webhook','public_pay','core_pos','field'
  ]));

-- Optional column: IP address of the payer (only set when source='public_pay')
ALTER TABLE public.billing_payments ADD COLUMN IF NOT EXISTS payer_ip text;
