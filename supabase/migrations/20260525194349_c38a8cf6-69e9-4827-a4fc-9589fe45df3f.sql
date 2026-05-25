WITH revoked AS (
  UPDATE public.crm_contacts c
     SET marketing_consent = false,
         unsubscribed_at   = COALESCE(c.unsubscribed_at, now()),
         consent_source    = COALESCE(c.consent_source, '') || ' (revoked_garbage_email)'
   WHERE c.marketing_consent = true
     AND c.email IS NOT NULL
     AND (
           lower(c.email) LIKE 'nomail@%'
        OR lower(c.email) LIKE 'noemail@%'
        OR lower(c.email) LIKE 'normail@%'
        OR lower(c.email) LIKE 'none@%'
        OR lower(c.email) LIKE 'no_email@%'
        OR lower(c.email) LIKE 'pasdemail@%'
        OR lower(c.email) LIKE 'sansmail@%'
        OR lower(c.email) LIKE 'aucun@%'
        OR lower(c.email) LIKE 'test@%'
        OR lower(c.email) LIKE 'fake@%'
        OR c.email ~* '^[a-z]@'
        OR c.email ~* '^[a-z]\.@'
        OR c.email ~* '^.{1,2}@'
        OR lower(c.email) IN (
             'john.doe@shopify.com','jane.doe@shopify.com',
             'jane@doe.com','john@doe.com','test@test.com','admin@example.com'
           )
        OR lower(c.email) LIKE '%@nivra-telecom.ca'
        OR lower(c.email) LIKE '%@nivratelecom.ca'
        OR lower(c.email) IN (
             'nivratelecom@gmail.com','nivratelecom@hotmail.com',
             'support@nivra-telecom.ca','admin@nivra-telecom.ca',
             'info@nivra-telecom.ca','noreply@nivra-telecom.ca','billing@nivra-telecom.ca'
           )
        OR lower(c.email) LIKE '%@gail.com'
        OR lower(c.email) LIKE '%@gmial.com'
        OR lower(c.email) LIKE '%@hotnail.com'
        OR lower(c.email) LIKE '%@yaho.com'
        OR lower(c.email) LIKE '%@yahooo.com'
     )
  RETURNING c.id, c.email
)
INSERT INTO public.security_events (event_type, severity, details)
SELECT
  'CRM_GARBAGE_EMAILS_REVOKED','warning',
  jsonb_build_object(
    'revoked_count', (SELECT count(*) FROM revoked),
    'sample', (SELECT jsonb_agg(email ORDER BY email) FROM (SELECT email FROM revoked LIMIT 30) s),
    'note', 'These contacts will no longer receive marketing — protects Resend sender reputation.'
  );

WITH cancelled AS (
  UPDATE public.email_queue eq
     SET status = 'cancelled', last_error = 'cancelled_garbage_email_address'
   WHERE eq.status IN ('queued','sending')
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
SELECT 'CRM_GARBAGE_EMAIL_QUEUE_CANCELLED','info',
  jsonb_build_object('cancelled_rows', (SELECT count(*) FROM cancelled));

INSERT INTO public.security_events (event_type, severity, details)
SELECT 'CRM_GARBAGE_EMAIL_POST_CLEANUP','info',
  jsonb_build_object(
    'consenting_remaining',
      (SELECT count(*) FROM public.crm_contacts WHERE marketing_consent = true AND unsubscribed_at IS NULL),
    'unique_consenting_domains',
      (SELECT count(DISTINCT split_part(email,'@',2)) FROM public.crm_contacts WHERE marketing_consent = true AND unsubscribed_at IS NULL),
    'note', 'These two numbers should both go down after this migration. Healthy list = real domains only.'
  );