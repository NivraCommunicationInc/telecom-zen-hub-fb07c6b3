-- Add client_name column to telephony_logs for storing client name when making calls
ALTER TABLE public.telephony_logs 
ADD COLUMN IF NOT EXISTS client_name TEXT;