-- Add number_lost_at column to accounts for 90+ day recovery tracking
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS number_lost_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add number_lost_reason column for admin notes
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS number_lost_reason TEXT DEFAULT NULL;

-- Add number_lost_by column to track which admin marked it
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS number_lost_by UUID DEFAULT NULL;

-- Create index for recovery queries
CREATE INDEX IF NOT EXISTS idx_accounts_number_lost ON public.accounts(number_lost_at) WHERE number_lost_at IS NOT NULL;

-- Add recouvrement_reminder_sent_at to track last reminder email
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS recouvrement_reminder_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;