-- ==============================================================================
-- GROWTH PHASE A — Internal email guardrail (hotfix)
-- ==============================================================================
-- Reason: owner / staff registered themselves at the POS, so their own
-- nivra-telecom.ca and nivratelecom@gmail.com addresses landed in crm_contacts.
-- The Phase A consent backfill marked them as CASL-implied, which caused the
-- agents to send the promo to the business mailbox as PRIMARY recipient
-- instead of just the BCC oversight copy.
--
-- This migration is idempotent — safe to apply even if the previous
-- consent backfill was already applied OR not yet applied.
-- ==============================================================================

-- 1) Revoke consent on every internal address already in crm_contacts.
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

-- 2) Cancel any still-queued promo rows aimed at an internal mailbox so the
--    next email worker pass does not flush them to the wrong recipient.
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
   -- Never cancel the BCC oversight copy. It is supposed to go to support.
   AND (template_vars->>'_bcc_original_recipient') IS NULL;

-- 3) Audit trail
INSERT INTO public.security_events (event_type, severity, details)
VALUES (
  'GROWTH_PHASE_A_INTERNAL_EMAIL_GUARD',
  'warning',
  jsonb_build_object(
    'note', 'Revoked marketing consent on internal Nivra addresses and cancelled mis-targeted queue rows.',
    'cause', 'Owner/staff self-registered at POS — their addresses were imported as Shopify contacts and the Phase A backfill marked them CASL-implied.',
    'fix_in_code', 'agent-crm-email-blast and agent-followup now filter @nivra-telecom.ca at SELECT and queueEmail() rejects internal recipients.'
  )
);
