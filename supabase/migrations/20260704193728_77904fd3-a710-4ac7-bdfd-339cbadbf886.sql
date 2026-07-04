
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz;

-- Allow "expired" status
ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_status_check;
ALTER TABLE public.contracts ADD CONSTRAINT contracts_status_check
  CHECK (status = ANY (ARRAY['draft','waiting_client_signature','signed_by_client','signed_by_admin','fully_signed','sent','void','superseded','expired']));

-- Schedule the reminder cron once (unschedule then re-schedule idempotently)
DO $$
BEGIN
  PERFORM cron.unschedule('contract-signature-reminders-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'contract-signature-reminders-daily',
  '15 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/contract-signature-reminders',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0Z25nbXR4Z2dhc2NieG5zd3ZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMDE2MzYsImV4cCI6MjA4MjY3NzYzNn0.BYQ3k1-N2_bbXCRTRcJ6FWoI6HuDP6BdhSrmCYhJai8"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  );
  $$
);
