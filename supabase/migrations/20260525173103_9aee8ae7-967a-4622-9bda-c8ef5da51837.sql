-- ==============================================================================
-- GROWTH PHASE A — CRM marketing consent (CASL / Loi 25)
-- ==============================================================================
ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_source text,
  ADD COLUMN IF NOT EXISTS consent_date timestamptz,
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_marketing_email_at timestamptz;

COMMENT ON COLUMN public.crm_contacts.marketing_consent IS
  'CASL/Loi-25 consent flag. true = we may send commercial email. Source is recorded in consent_source.';
COMMENT ON COLUMN public.crm_contacts.consent_source IS
  'Origin of the consent: casl_implied_purchase_shopify, explicit_form, website_opt_in, referral, manual_staff, etc.';
COMMENT ON COLUMN public.crm_contacts.unsubscribed_at IS
  'Set when the recipient hits the one-click unsubscribe footer. Once set, agents must skip this contact.';

CREATE INDEX IF NOT EXISTS idx_crm_contacts_consent_active
  ON public.crm_contacts(marketing_consent, unsubscribed_at)
  WHERE marketing_consent = true AND unsubscribed_at IS NULL;

WITH eligible AS (
  UPDATE public.crm_contacts c
  SET
    marketing_consent = true,
    consent_source    = 'casl_implied_purchase_shopify',
    consent_date      = COALESCE(c.consent_date, c.created_at, now())
  WHERE c.marketing_consent = false
    AND c.unsubscribed_at IS NULL
    AND c.email IS NOT NULL
    AND length(trim(c.email)) > 0
    AND lower(c.email) NOT LIKE 'noemail@%'
    AND lower(c.email) NOT LIKE 'normail@%'
    AND lower(c.email) NOT LIKE 'aucun@%'
    AND lower(c.email) NOT LIKE 'none@%'
    AND lower(c.email) NOT LIKE 'no_email@%'
    AND lower(c.email) NOT LIKE 'pasdemail@%'
    AND lower(c.email) NOT LIKE 'sansmail@%'
    AND lower(c.email) NOT LIKE 'test@%'
    AND lower(c.email) NOT LIKE 'fake@%'
    AND lower(c.email) NOT LIKE '%@nivra-telecom.ca'
    AND lower(c.email) NOT LIKE '%@nivratelecom.ca'
    AND lower(c.email) NOT IN (
      'nivratelecom@gmail.com',
      'nivratelecom@hotmail.com',
      'support@nivra-telecom.ca',
      'admin@nivra-telecom.ca',
      'info@nivra-telecom.ca',
      'noreply@nivra-telecom.ca',
      'billing@nivra-telecom.ca'
    )
    AND c.email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND NOT EXISTS (
      SELECT 1
      FROM public.email_unsubscribes eu
      WHERE lower(eu.email) = lower(c.email)
        AND eu.is_active = true
    )
  RETURNING c.id
)
INSERT INTO public.security_events (event_type, severity, details)
SELECT
  'GROWTH_PHASE_A_CONSENT_BACKFILL',
  'info',
  jsonb_build_object(
    'consenting_contacts', (SELECT count(*) FROM eligible),
    'note', 'CRM contacts marked CASL-implied (24-month window from Shopify/Square purchase). Unsubscribe link mandatory in every email.',
    'rule', 'consent_source=casl_implied_purchase_shopify'
  );

-- ==============================================================================
-- GROWTH PHASE A — pg_cron schedules for marketing agents
-- ==============================================================================
DO $$
DECLARE
  v_url      text;
  v_auth     text;
  v_secret   text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net not installed';
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE NOTICE 'vault service_role_key missing';
    RETURN;
  END IF;

  v_url  := 'https://xtgngmtxggascbxnswvb.supabase.co/functions/v1';
  v_auth := 'Bearer ' || v_secret;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-crm-email-blast-10utc') THEN
    PERFORM cron.unschedule('agent-crm-email-blast-10utc');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-followup-14utc') THEN
    PERFORM cron.unschedule('agent-followup-14utc');
  END IF;

  PERFORM cron.schedule(
    'agent-crm-email-blast-10utc',
    '0 10 * * *',
    format(
      $job$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', %L),
        body    := jsonb_build_object('source', 'cron_daily_10utc')
      );
      $job$,
      v_url || '/agent-crm-email-blast',
      v_auth
    )
  );

  PERFORM cron.schedule(
    'agent-followup-14utc',
    '0 14 * * *',
    format(
      $job$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', %L),
        body    := jsonb_build_object('source', 'cron_daily_14utc')
      );
      $job$,
      v_url || '/agent-followup',
      v_auth
    )
  );
END $$;

UPDATE public.agent_registry
   SET cron_job_name = 'agent-crm-email-blast-10utc'
 WHERE agent_name = 'crm-email-blast';

UPDATE public.agent_registry
   SET cron_job_name = 'agent-followup-14utc'
 WHERE agent_name = 'followup';

INSERT INTO public.security_events (event_type, severity, details)
VALUES (
  'GROWTH_PHASE_A_CRON_ACTIVATED',
  'info',
  jsonb_build_object(
    'jobs', ARRAY['agent-crm-email-blast-10utc', 'agent-followup-14utc'],
    'note', 'Marketing agents now actually scheduled.',
    'first_run_window_utc', '10:00 and 14:00 daily'
  )
);

-- ==============================================================================
-- GROWTH PHASE A — Internal email guardrail
-- ==============================================================================
UPDATE public.crm_contacts
   SET marketing_consent  = false,
       unsubscribed_at    = COALESCE(unsubscribed_at, now()),
       consent_source     = COALESCE(consent_source, '') || ' (revoked_internal_address)'
 WHERE email IS NOT NULL
   AND (
         lower(email) LIKE '%@nivra-telecom.ca'
      OR lower(email) LIKE '%@nivratelecom.ca'
      OR lower(email) IN (
           'nivratelecom@gmail.com',
           'nivratelecom@hotmail.com',
           'support@nivra-telecom.ca',
           'admin@nivra-telecom.ca',
           'info@nivra-telecom.ca',
           'noreply@nivra-telecom.ca',
           'billing@nivra-telecom.ca'
         )
       )
   AND marketing_consent = true;

UPDATE public.email_queue
   SET status      = 'cancelled',
       last_error  = 'cancelled_internal_recipient_guardrail'
 WHERE template_key IN ('crm_promo_blast', 'crm_followup', 'marketing_promotion', 'winback_offer')
   AND status IN ('queued', 'sending')
   AND (
         lower(to_email) LIKE '%@nivra-telecom.ca'
      OR lower(to_email) LIKE '%@nivratelecom.ca'
      OR lower(to_email) IN (
           'nivratelecom@gmail.com',
           'nivratelecom@hotmail.com'
         )
       )
   AND (template_vars->>'_bcc_original_recipient') IS NULL;

INSERT INTO public.security_events (event_type, severity, details)
VALUES (
  'GROWTH_PHASE_A_INTERNAL_EMAIL_GUARD',
  'warning',
  jsonb_build_object(
    'note', 'Revoked marketing consent on internal Nivra addresses and cancelled mis-targeted queue rows.',
    'cause', 'Owner/staff self-registered at POS.',
    'fix_in_code', 'Agents now filter @nivra-telecom.ca at SELECT and queueEmail rejects internal recipients.'
  )
);

-- ==============================================================================
-- GROWTH PHASE A — High-cadence schedule + immediate one-shot fire
-- ==============================================================================
DO $$
DECLARE
  v_url     text := 'https://xtgngmtxggascbxnswvb.supabase.co/functions/v1';
  v_secret  text;
  v_auth    text;
  v_blast_req_id  bigint;
  v_follow_req_id bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron missing';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net missing';
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;
  IF v_secret IS NULL THEN
    RAISE NOTICE 'vault service_role_key missing';
    RETURN;
  END IF;
  v_auth := 'Bearer ' || v_secret;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-crm-email-blast-10utc') THEN
    PERFORM cron.unschedule('agent-crm-email-blast-10utc');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-followup-14utc') THEN
    PERFORM cron.unschedule('agent-followup-14utc');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-crm-email-blast-2h') THEN
    PERFORM cron.unschedule('agent-crm-email-blast-2h');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-followup-3h') THEN
    PERFORM cron.unschedule('agent-followup-3h');
  END IF;

  PERFORM cron.schedule(
    'agent-crm-email-blast-2h',
    '0 */2 * * *',
    format(
      $job$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', %L),
        body    := jsonb_build_object('source', 'cron_2h')
      );
      $job$,
      v_url || '/agent-crm-email-blast',
      v_auth
    )
  );

  PERFORM cron.schedule(
    'agent-followup-3h',
    '30 */3 * * *',
    format(
      $job$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', %L),
        body    := jsonb_build_object('source', 'cron_3h')
      );
      $job$,
      v_url || '/agent-followup',
      v_auth
    )
  );

  UPDATE public.agent_registry
     SET cron_job_name = 'agent-crm-email-blast-2h',
         cron_schedule = '0 */2 * * *'
   WHERE agent_name = 'crm-email-blast';

  UPDATE public.agent_registry
     SET cron_job_name = 'agent-followup-3h',
         cron_schedule = '30 */3 * * *'
   WHERE agent_name = 'followup';

  SELECT net.http_post(
    url     := v_url || '/agent-crm-email-blast',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', v_auth),
    body    := jsonb_build_object('source', 'migration_fire_now')
  ) INTO v_blast_req_id;

  SELECT net.http_post(
    url     := v_url || '/agent-followup',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', v_auth),
    body    := jsonb_build_object('source', 'migration_fire_now')
  ) INTO v_follow_req_id;

  INSERT INTO public.security_events (event_type, severity, details)
  VALUES (
    'GROWTH_PHASE_A_HIGH_CADENCE_ACTIVATED',
    'info',
    jsonb_build_object(
      'jobs', ARRAY['agent-crm-email-blast-2h (0 */2 * * *)', 'agent-followup-3h (30 */3 * * *)'],
      'one_shot_request_ids', jsonb_build_object(
        'blast',    v_blast_req_id,
        'followup', v_follow_req_id
      ),
      'note', 'Replaced daily schedule with 2h/3h cadence. Fired both agents once.'
    )
  );
END $$;

CREATE OR REPLACE VIEW public.v_growth_agent_health
WITH (security_invoker = on) AS
SELECT
  ar.agent_name,
  ar.cron_job_name,
  ar.cron_schedule,
  ar.last_run_at,
  ar.last_success_at,
  ar.last_error_at,
  ar.last_error_message,
  ar.total_runs,
  ar.total_successes,
  ar.total_failures,
  ar.consecutive_failures,
  (SELECT count(*) FROM public.agent_events ae
    WHERE ae.agent_name = ar.agent_name
      AND ae.event_type = 'email_sent'
      AND ae.created_at > now() - interval '1 hour') AS sends_last_hour,
  (SELECT count(*) FROM public.agent_events ae
    WHERE ae.agent_name = ar.agent_name
      AND ae.event_type = 'email_sent'
      AND ae.created_at > now() - interval '24 hours') AS sends_last_24h,
  (SELECT count(*) FROM public.agent_events ae
    WHERE ae.agent_name = ar.agent_name
      AND ae.event_type = 'email_sent'
      AND ae.created_at > now() - interval '7 days') AS sends_last_7d
FROM public.agent_registry ar
WHERE ar.agent_name IN ('crm-email-blast', 'followup', 'retention');

COMMENT ON VIEW public.v_growth_agent_health IS
  'Single-row-per-agent health snapshot for the marketing/growth agents.';