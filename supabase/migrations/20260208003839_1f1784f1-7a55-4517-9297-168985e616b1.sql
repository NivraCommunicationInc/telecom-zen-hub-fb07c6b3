-- ============================================================================
-- Add billing snapshots for PDF generation (V2.5)
-- These fields store immutable client/payment data at invoice creation/payment
-- ============================================================================

-- Client snapshot fields (captured at invoice creation)
ALTER TABLE public.billing_invoices 
ADD COLUMN IF NOT EXISTS billing_snapshot_client JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS billing_snapshot_account_number TEXT DEFAULT NULL;

-- Payment confirmation fields (captured when paid)
ALTER TABLE public.billing_invoices 
ADD COLUMN IF NOT EXISTS billing_snapshot_payment JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.billing_invoices.billing_snapshot_client IS 
'Immutable snapshot of client data at invoice creation: {full_name, email, phone, address_line1, address_line2, city, province, postal_code}';

COMMENT ON COLUMN public.billing_invoices.billing_snapshot_account_number IS 
'Immutable 6-digit account number from accounts table (not profiles.id)';

COMMENT ON COLUMN public.billing_invoices.billing_snapshot_payment IS 
'Payment confirmation data when paid: {method, paid_at, transaction_id, capture_id, last4, reference}';

-- Create index for quick account number lookups
CREATE INDEX IF NOT EXISTS idx_billing_invoices_snapshot_account 
ON public.billing_invoices(billing_snapshot_account_number);