-- ==============================================================================
-- REQUEUE — DLQ emails whose template is now available
-- ==============================================================================
-- 14 emails are stuck in DLQ with error `No template available for key '...'`
-- because the worker tried to send them BEFORE the corresponding case was
-- added to `customQueueTemplates.ts`. With this migration's companion edit
-- (appointment_updated added + existing crm_promo_blast / social_post_ready /
-- directories_reminder / agent_welcome_confirmed already present), the worker
-- can now render them. Reset their status to queued so the next drain picks
-- them up.
--
-- Safety: we only requeue emails created in the last 7 days. Older DLQ
-- entries stay archived (don't email stale promos to people).
-- ==============================================================================

UPDATE public.email_queue
SET
  status   = 'queued',
  attempts = 0,
  last_error = 'requeued_after_template_added — was: ' || COALESCE(last_error, ''),
  updated_at = now()
WHERE status = 'dlq'
  AND created_at > now() - interval '7 days'
  AND template_key IN (
    'crm_promo_blast',
    'social_post_ready',
    'directories_reminder',
    'agent_welcome_confirmed',
    'appointment_updated'
  );

-- Audit
INSERT INTO public.security_events (event_type, severity, details)
VALUES (
  'DLQ_REQUEUED_AFTER_TEMPLATE_FIX',
  'info',
  jsonb_build_object(
    'description', 'Requeued DLQ emails whose template_key is now available in customQueueTemplates.ts',
    'templates_now_available', ARRAY[
      'crm_promo_blast',
      'social_post_ready',
      'directories_reminder',
      'agent_welcome_confirmed',
      'appointment_updated'
    ],
    'applied_at', now()
  )
);
