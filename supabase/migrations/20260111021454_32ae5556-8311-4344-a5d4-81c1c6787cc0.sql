-- Add balance_due column to billing table
ALTER TABLE public.billing 
ADD COLUMN IF NOT EXISTS balance_due numeric DEFAULT 0;