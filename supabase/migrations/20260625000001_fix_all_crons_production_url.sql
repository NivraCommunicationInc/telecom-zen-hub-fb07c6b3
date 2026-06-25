-- =============================================================================
-- CORRECTIF CRITIQUE : Remplace toutes les URLs de cron
-- lacxnbjvcyvhrttprkxr (projet secondaire abandonné)
--  → xtgngmtxggascbxnswvb (vrai projet de production Lovable)
--
-- Tous les jobs sont d'abord supprimés (idempotent), puis recréés
-- avec les bonnes URLs et l'auth via vault (pas de clés hardcodées).
-- =============================================================================

-- ─── Suppression de tous les jobs existants (idempotent) ────────────────────
DO $$
DECLARE
  _jobs TEXT[] := ARRAY[
    'billing-lifecycle','billing-dunning-engine','billing-generate-renewals',
    'process-document-jobs','process-email-queue','email-queue-drain',
    'sms-queue-drain','paypal-reconcile','billing-reconcile-invoices',
    'billing-daily-overdue-reminders','billing-autopay-invitations',
    'billing-admin-daily-digest-8am','billing-paypal-retry-failed',
    'billing-data-retention','noc-monitor','nova-watchdog','agent-supervisor',
    'revenue-assurance','support-ai-responder','crm-score-leads',
    'sla-monitor','nps-survey-batch','complaint-escalate-crtc',
    'nivra-health-check','network-uptime-check','daily-data-backup',
    'daily-backup-export','commission-monthly-report','weekly-sales-report'
  ];
  _j TEXT;
BEGIN
  FOREACH _j IN ARRAY _jobs LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = _j) THEN
      PERFORM cron.unschedule(_j);
    END IF;
  END LOOP;
END $$;

-- ─── Helper : URL de base du vrai projet de production ──────────────────────
-- Hardcodée pour éviter toute dépendance au vault 'project_url'.
-- xtgngmtxggascbxnswvb = vrai projet Lovable / production.

-- ─── BILLING CRITIQUE ───────────────────────────────────────────────────────

-- billing-lifecycle : J+5 suspension, J+10 annulation + PayPal cancel
SELECT cron.schedule(
  'billing-lifecycle',
  '0 8 * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/billing-lifecycle',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- billing-dunning-engine : J+3 email doux, J+7 urgent, J+14 final + suspend
SELECT cron.schedule(
  'billing-dunning-engine',
  '15 9 * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/billing-dunning-engine',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- billing-generate-renewals : génération des factures mensuelles (minuit UTC)
SELECT cron.schedule(
  'billing-generate-renewals',
  '0 0 * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/billing-generate-renewals',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- billing-daily-overdue-reminders : relances journalières 09:00 UTC
SELECT cron.schedule(
  'billing-daily-overdue-reminders',
  '0 9 * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/billing-daily-overdue-reminders',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- billing-autopay-invitations : lundi 10:00 UTC
SELECT cron.schedule(
  'billing-autopay-invitations',
  '0 10 * * 1',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/billing-autopay-invitations',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- billing-admin-daily-digest-8am : digest admin 12:00 UTC
SELECT cron.schedule(
  'billing-admin-daily-digest-8am',
  '0 12 * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/billing-admin-daily-digest',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{"source":"cron_daily_8am"}'::jsonb
  )$$
);

-- billing-paypal-retry-failed : retry PayPal échoués 06:00 UTC
SELECT cron.schedule(
  'billing-paypal-retry-failed',
  '0 6 * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/billing-paypal-retry-failed',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- billing-data-retention : nettoyage données billing 03:00 UTC
SELECT cron.schedule(
  'billing-data-retention',
  '0 3 * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/billing-data-retention',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{"dry_run":false}'::jsonb
  )$$
);

-- billing-reconcile-invoices : réconciliation 01:30 UTC
SELECT cron.schedule(
  'billing-reconcile-invoices',
  '30 1 * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/billing-reconcile-invoices',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- paypal-reconcile : réconciliation PayPal 04:00 UTC
SELECT cron.schedule(
  'paypal-reconcile',
  '0 4 * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/paypal-reconcile',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- ─── QUEUES (chaque minute) ──────────────────────────────────────────────────

-- process-email-queue
SELECT cron.schedule(
  'process-email-queue',
  '* * * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/process-email-queue',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- email-queue-drain
SELECT cron.schedule(
  'email-queue-drain',
  '* * * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/email-queue-drain',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- sms-queue-drain
SELECT cron.schedule(
  'sms-queue-drain',
  '* * * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/sms-queue-drain',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- process-document-jobs : génération PDF auto chaque minute
SELECT cron.schedule(
  'process-document-jobs',
  '* * * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/process-document-jobs',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- ─── MONITORING / INFRA ──────────────────────────────────────────────────────

-- noc-monitor : toutes les 30 minutes
SELECT cron.schedule(
  'noc-monitor',
  '*/30 * * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/noc-monitor',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- nova-watchdog : toutes les 30 minutes
SELECT cron.schedule(
  'nova-watchdog',
  '*/30 * * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/nova-watchdog',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- agent-supervisor : toutes les 6 heures
SELECT cron.schedule(
  'agent-supervisor',
  '0 */6 * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/agent-supervisor',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- revenue-assurance : 03:30 UTC
SELECT cron.schedule(
  'revenue-assurance',
  '30 3 * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/revenue-assurance',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- support-ai-responder : toutes les 2 minutes
SELECT cron.schedule(
  'support-ai-responder',
  '*/2 * * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/support-ai-responder',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{"cron":true}'::jsonb
  )$$
);

-- crm-score-leads : 06:00 UTC
SELECT cron.schedule(
  'crm-score-leads',
  '0 6 * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/crm-score-leads',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- sla-monitor : 08:00 UTC
SELECT cron.schedule(
  'sla-monitor',
  '0 8 * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/sla-monitor',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- nps-survey-batch : 14:00 UTC
SELECT cron.schedule(
  'nps-survey-batch',
  '0 14 * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/nps-survey-batch',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- complaint-escalate-crtc : 10:00 UTC
SELECT cron.schedule(
  'complaint-escalate-crtc',
  '0 10 * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/complaint-escalate-crtc',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb,
    timeout_milliseconds:=30000
  )$$
);

-- nivra-health-check : 06:00 UTC
SELECT cron.schedule(
  'nivra-health-check',
  '0 6 * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/nivra-health-check',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb,
    timeout_milliseconds:=30000
  )$$
);

-- network-uptime-check : toutes les 5 minutes
SELECT cron.schedule(
  'network-uptime-check',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/network-uptime-check',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- daily-data-backup : 02:00 UTC
SELECT cron.schedule(
  'daily-data-backup',
  '0 2 * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/daily-data-backup',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- daily-backup-export : 10:00 UTC
SELECT cron.schedule(
  'daily-backup-export',
  '0 10 * * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/daily-backup-export',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- commission-monthly-report : 1er du mois 08:00 UTC
SELECT cron.schedule(
  'commission-monthly-report',
  '0 8 1 * *',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/commission-monthly-report',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);

-- weekly-sales-report : lundi 13:00 UTC
SELECT cron.schedule(
  'weekly-sales-report',
  '0 13 * * 1',
  $$SELECT net.http_post(
    url:='https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/weekly-sales-report',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body:='{}'::jsonb
  )$$
);
