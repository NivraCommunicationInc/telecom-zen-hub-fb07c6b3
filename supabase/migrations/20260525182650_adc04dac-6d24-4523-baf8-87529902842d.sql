-- 1) Cancel pending BCC marketing rows
WITH cancelled AS (
  UPDATE public.email_queue
     SET status     = 'cancelled',
         last_error = 'cancelled_marketing_bcc_no_longer_sent'
   WHERE status IN ('queued', 'sending')
     AND template_key IN (
       'crm_promo_blast',
       'crm_followup',
       'crm_sequence_social',
       'crm_sequence_savings',
       'crm_sequence_lastcall',
       'marketing_promotion',
       'winback_offer'
     )
     AND (template_vars->>'_bcc_original_recipient') IS NOT NULL
  RETURNING id
)
INSERT INTO public.security_events (event_type, severity, details)
SELECT
  'BCC_MARKETING_QUEUE_CANCELLED',
  'info',
  jsonb_build_object(
    'cancelled_rows', (SELECT count(*) FROM cancelled),
    'note', 'Pending BCC copies of marketing emails were cancelled. Real client rows are untouched.'
  );

-- 2) Diagnostic snapshot
INSERT INTO public.security_events (event_type, severity, details)
SELECT
  'MARKETING_RECIPIENT_AUDIT',
  'info',
  jsonb_build_object(
    'total_marketing_rows_30d',
      (SELECT count(*) FROM public.email_queue
        WHERE template_key IN ('crm_promo_blast','crm_followup','crm_sequence_social','crm_sequence_savings','crm_sequence_lastcall','marketing_promotion','winback_offer')
          AND created_at > now() - interval '30 days'),
    'sent_to_clients_30d',
      (SELECT count(*) FROM public.email_queue
        WHERE template_key IN ('crm_promo_blast','crm_followup','crm_sequence_social','crm_sequence_savings','crm_sequence_lastcall','marketing_promotion','winback_offer')
          AND created_at > now() - interval '30 days'
          AND (template_vars->>'_bcc_original_recipient') IS NULL
          AND lower(to_email) NOT IN ('support@nivra-telecom.ca','nivratelecom@gmail.com')),
    'sent_to_support_bcc_30d',
      (SELECT count(*) FROM public.email_queue
        WHERE template_key IN ('crm_promo_blast','crm_followup','crm_sequence_social','crm_sequence_savings','crm_sequence_lastcall','marketing_promotion','winback_offer')
          AND created_at > now() - interval '30 days'
          AND lower(to_email) = 'support@nivra-telecom.ca'),
    'unique_client_recipients_30d',
      (SELECT count(DISTINCT lower(to_email)) FROM public.email_queue
        WHERE template_key IN ('crm_promo_blast','crm_followup','crm_sequence_social','crm_sequence_savings','crm_sequence_lastcall','marketing_promotion','winback_offer')
          AND created_at > now() - interval '30 days'
          AND lower(to_email) NOT IN ('support@nivra-telecom.ca','nivratelecom@gmail.com')),
    'note', 'sent_to_clients_30d should be (sent_to_support_bcc_30d). If they match, your client deliveries DID happen — the support inbox just got a copy of every one.'
  );