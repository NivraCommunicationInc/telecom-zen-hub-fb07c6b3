-- Helper: lire emails DLQ par msg_id
CREATE OR REPLACE FUNCTION public.get_dlq_emails_for_resend(p_msg_ids bigint[])
RETURNS TABLE(msg_id bigint, to_email text, subject text, html text, from_email text, label text)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pgmq AS $$
  SELECT
    d.msg_id,
    d.message->>'to'      AS to_email,
    d.message->>'subject' AS subject,
    d.message->>'html'    AS html,
    d.message->>'from'    AS from_email,
    d.message->>'label'   AS label
  FROM pgmq.q_transactional_emails_dlq d
  WHERE d.msg_id = ANY(p_msg_ids);
$$;

-- Helper: supprimer un message du DLQ apres envoi reussi
CREATE OR REPLACE FUNCTION public.archive_dlq_message(p_msg_id bigint)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public, pgmq AS $$
  SELECT pgmq.delete('transactional_emails_dlq', p_msg_id);
$$;

-- Cron: process-email-queue toutes les minutes (meme modele que email-queue-drain / cron ID 30)
SELECT cron.schedule(
  'process-email-queue',
  '* * * * *',
  $$SELECT net.http_post(
    url:='https://lacxnbjvcyvhrttprkxr.supabase.co/functions/v1/process-email-queue',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhY3huYmp2Y3l2aHJ0dHBya3hyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQyMjY2MywiZXhwIjoyMDk1OTk4NjYzfQ.gfv9cuDf4XFVbaKmuA2ofx8IC-pJ6NyjpX3SXr3dw-M"}'::jsonb,
    body:='{}'::jsonb
  )$$
);
