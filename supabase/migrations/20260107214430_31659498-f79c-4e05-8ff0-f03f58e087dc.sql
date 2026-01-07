-- Migrate chatbot_logs to remove PII
-- Step 1: Add new columns for metadata-only logging
ALTER TABLE public.chatbot_logs 
ADD COLUMN IF NOT EXISTS message_length integer,
ADD COLUMN IF NOT EXISTS response_length integer,
ADD COLUMN IF NOT EXISTS message_hash text;

-- Step 2: Migrate existing data - convert text to lengths, set hash to null for existing
UPDATE public.chatbot_logs 
SET 
  message_length = COALESCE(LENGTH(user_message), 0),
  response_length = COALESCE(LENGTH(bot_response), 0),
  message_hash = NULL
WHERE message_length IS NULL;

-- Step 3: Clear PII from existing records (set to redacted placeholder)
UPDATE public.chatbot_logs 
SET 
  user_message = '[REDACTED]',
  bot_response = '[REDACTED]'
WHERE user_message != '[REDACTED]' OR bot_response != '[REDACTED]';

-- Add comment explaining the columns
COMMENT ON COLUMN public.chatbot_logs.message_length IS 'Length of original user message (PII-safe)';
COMMENT ON COLUMN public.chatbot_logs.response_length IS 'Length of bot response (PII-safe)';
COMMENT ON COLUMN public.chatbot_logs.message_hash IS 'SHA-256 hash of user message for deduplication (optional, no PII)';