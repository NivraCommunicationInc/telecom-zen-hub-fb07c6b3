-- Add new columns to telephony_logs for OpenPhone integration
ALTER TABLE public.telephony_logs 
ADD COLUMN IF NOT EXISTS openphone_call_id TEXT,
ADD COLUMN IF NOT EXISTS openphone_message_id TEXT,
ADD COLUMN IF NOT EXISTS message_preview TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_telephony_logs_openphone_call_id ON public.telephony_logs(openphone_call_id) WHERE openphone_call_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_telephony_logs_openphone_message_id ON public.telephony_logs(openphone_message_id) WHERE openphone_message_id IS NOT NULL;