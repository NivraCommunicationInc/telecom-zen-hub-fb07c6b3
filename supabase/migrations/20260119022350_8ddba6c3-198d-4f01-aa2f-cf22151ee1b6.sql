-- Add billing_type column to services table
ALTER TABLE public.services 
ADD COLUMN billing_type TEXT DEFAULT 'monthly';

-- Add comment for documentation
COMMENT ON COLUMN public.services.billing_type IS 'Billing period type: 30_days, monthly, yearly, one_time';