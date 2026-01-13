-- Allow logging SMS/calls even when a client profile cannot be matched
ALTER TABLE public.telephony_logs
ALTER COLUMN client_id DROP NOT NULL;