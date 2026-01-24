-- Fix ticket_replies sender_role to be required with default 'client'
-- Step 1: Set default value
ALTER TABLE public.ticket_replies ALTER COLUMN sender_role SET DEFAULT 'client';

-- Step 2: Backfill any NULL values
UPDATE public.ticket_replies SET sender_role = 'client' WHERE sender_role IS NULL;

-- Step 3: Make column NOT NULL
ALTER TABLE public.ticket_replies ALTER COLUMN sender_role SET NOT NULL;