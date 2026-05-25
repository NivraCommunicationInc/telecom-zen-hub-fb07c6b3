-- ==============================================================================
-- HOTFIX — Revoke marketing consent on garbage / placeholder / test emails
-- ==============================================================================
-- The Phase A backfill exclusion list was incomplete. After auditing the
-- top 30 marketing recipients we see addresses like nomail@koodo.ca,
-- x@gmail.com, x.@gail.com, john.doe@shopify.com, jane.doe@shopify.com.
-- They bounce at ~100% and erode the Resend sender reputation, which then
-- hurts deliverability for the real 47 unique client recipients.
--
-- Also forces support@nivra-telecom.ca to ALWAYS be off the marketing list,
-- regardless of how it was added.
--
-- Idempotent — safe to apply at any time. Re-running will not double-revoke.
-- ==============================================================================

WITH revoked AS (
  UPDATE public.crm_contacts c
     SET marketing_consent = false,
         unsubscribed_at   = COALESCE(c.unsubscribed_at, now()),
         consent_source    = COALESCE(c.consent_source, '') || ' (revoked_garbage_email)'
   WHERE c.marketing_consent = true
     AND c.email IS NOT NULL
     AND (
           -- Placeholder addresses we forgot in Phase A
           lower(c.email) LIKE 'nomail@%'           -- nomail@koodo.ca etc (note: missing the second 'e')
        OR lower(c.email) LIKE 'noemail@%'         -- already in Phase A, kept for idempotency
        OR lower(c.email) LIKE 'normail@%'
        OR lower(c.email) LIKE 'none@%'
        OR lower(c.email) LIKE 'no_email@%'
        OR lower(c.email) LIKE 'pasdemail@%'
        OR lower(c.email) LIKE 'sansmail@%'
        OR lower(c.email) LIKE 'aucun@%'
        OR lower(c.email) LIKE 'test@%'
        OR lower(c.email) LIKE 'fake@%'

           -- Single-letter / junk local parts
        OR c.email ~* '^[a-z]@'                    -- x@gmail.com, a@..., y@... etc
        OR c.email ~* '^[a-z]\.@'                  -- x.@gail.com etc
        OR c.email ~* '^.{1,2}@'                   -- any local part <= 2 chars

           -- Obvious test data
        OR lower(c.email) IN (
             'john.doe@shopify.com',
             'jane.doe@shopify.com',
             'jane@doe.com',
             'john@doe.com',
             'test@test.com',
             'admin@example.com'
           )

           -- Internal Nivra addresses — belt-and-suspenders, even though
           -- Phase A and the internal guard already revoked them.
        OR lower(c.email) LIKE '%@nivra-telecom.ca'
        OR lower(c.email) LIKE '%@nivratelecom.ca'
        OR lower(c.email) IN (
             'nivratelecom@gmail.com',
             'nivratelecom@hotmail.com',
             'support@nivra-telecom.ca',
             'admin@nivra-telecom.ca',
             'info@nivra-telecom.ca',
             'noreply@nivra-telecom.ca',
             'billing@nivra-telecom.ca'
           )

           -- Invalid domains we have seen bouncing
        OR lower(c.email) LIKE '%@gail.com'        -- typo of gmail.com, 100% bounce
        OR lower(c.email) LIKE '%@gmial.com'
        OR lower(c.email) LIKE '%@hotnail.com'
        OR lower(c.email) LIKE '%@yaho.com'
        OR lower(c.email) LIKE '%@yahooo.com'
     )
  RETURNING c.id, c.email
)
INSERT INTO public.security_events (event_type, severity, details)
SELECT
  'CRM_GARBAGE_EMAILS_REVOKED',
  'warning',
  jsonb_build_object(
    'revoked_count', (SELECT count(*) FROM revoked),
    'sample',        (SELECT jsonb_agg(email ORDER BY email) FROM (SELECT email FROM revoked LIMIT 30) s),
    'note', 'These contacts will no longer receive marketing — protects Resend sender reputation.'
  );

-- Cancel any queue rows still pending for these addresses so the worker
-- does not flush them on its next pass.
WITH cancelled AS (
  UPDATE public.email_queue eq
     SET status     = 'cancelled',
         last_error = 'cancelled_garbage_email_address'
   WHERE eq.status IN ('queued', 'sending')
     AND eq.template_key IN (
       'crm_promo_blast','crm_followup','crm_sequence_social',
       'crm_sequence_savings','crm_sequence_lastcall',
       'marketing_promotion','winback_offer'
     )
     AND (
           lower(eq.to_email) LIKE 'nomail@%'
        OR lower(eq.to_email) LIKE 'noemail@%'
        OR lower(eq.to_email) LIKE 'normail@%'
        OR lower(eq.to_email) LIKE 'none@%'
        OR lower(eq.to_email) LIKE 'no_email@%'
        OR lower(eq.to_email) LIKE 'pasdemail@%'
        OR lower(eq.to_email) LIKE 'sansmail@%'
        OR lower(eq.to_email) LIKE 'aucun@%'
        OR lower(eq.to_email) LIKE 'test@%'
        OR lower(eq.to_email) LIKE 'fake@%'
        OR eq.to_email ~* '^[a-z]@'
        OR eq.to_email ~* '^[a-z]\.@'
        OR eq.to_email ~* '^.{1,2}@'
        OR lower(eq.to_email) IN (
             'john.doe@shopify.com','jane.doe@shopify.com',
             'jane@doe.com','john@doe.com','test@test.com','admin@example.com'
           )
        OR lower(eq.to_email) LIKE '%@nivra-telecom.ca'
        OR lower(eq.to_email) LIKE '%@nivratelecom.ca'
        OR lower(eq.to_email) LIKE '%@gail.com'
        OR lower(eq.to_email) LIKE '%@gmial.com'
        OR lower(eq.to_email) LIKE '%@hotnail.com'
        OR lower(eq.to_email) LIKE '%@yaho.com'
        OR lower(eq.to_email) LIKE '%@yahooo.com'
     )
  RETURNING id
)
INSERT INTO public.security_events (event_type, severity, details)
SELECT
  'CRM_GARBAGE_EMAIL_QUEUE_CANCELLED',
  'info',
  jsonb_build_object('cancelled_rows', (SELECT count(*) FROM cancelled));

-- Post-cleanup snapshot
INSERT INTO public.security_events (event_type, severity, details)
SELECT
  'CRM_GARBAGE_EMAIL_POST_CLEANUP',
  'info',
  jsonb_build_object(
    'consenting_remaining',
      (SELECT count(*) FROM public.crm_contacts
        WHERE marketing_consent = true AND unsubscribed_at IS NULL),
    'unique_consenting_domains',
      (SELECT count(DISTINCT split_part(email, '@', 2)) FROM public.crm_contacts
        WHERE marketing_consent = true AND unsubscribed_at IS NULL),
    'note', 'These two numbers should both go down after this migration. Healthy list = real domains only.'
  );
