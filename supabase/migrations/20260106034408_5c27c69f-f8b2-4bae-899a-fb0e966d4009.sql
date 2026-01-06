-- Add email tracking field to orders table for idempotency
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_email_sent_at timestamptz;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_orders_confirmation_email_sent_at ON orders (confirmation_email_sent_at) WHERE confirmation_email_sent_at IS NOT NULL;