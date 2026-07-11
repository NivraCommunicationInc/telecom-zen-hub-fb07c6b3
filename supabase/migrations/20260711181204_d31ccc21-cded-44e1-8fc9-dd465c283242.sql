
-- Module 46 — Phase 2: canonical customer communications view
-- Unifies email_queue, sms_queue, notification_outbox, notifications and crm_call_logs
-- into a single feed consumed by Client 360.

CREATE OR REPLACE VIEW public.v_customer_communications
WITH (security_invoker = on) AS
SELECT
  ('email:' || eq.id::text)                    AS row_id,
  eq.id                                        AS source_id,
  'email'::text                                AS channel,
  'outbound'::text                             AS direction,
  eq.to_email                                  AS recipient,
  NULL::text                                   AS phone,
  eq.subject                                   AS subject,
  eq.template_key                              AS template_key,
  eq.status                                    AS status,
  eq.delivered_at                              AS delivered_at,
  eq.opened_at                                 AS opened_at,
  eq.bounced_at                                AS bounced_at,
  eq.sent_at                                   AS sent_at,
  eq.created_at                                AS created_at,
  eq.actor_user_id                             AS actor_user_id,
  eq.actor_role                                AS actor_role,
  eq.correlation_id                            AS correlation_id,
  eq.entity_type                               AS entity_type,
  eq.entity_id                                 AS entity_id,
  NULL::uuid                                   AS client_id,
  eq.last_error                                AS error_message
FROM public.email_queue eq

UNION ALL
SELECT
  ('sms:' || sq.id::text),
  sq.id,
  'sms',
  'outbound',
  NULL,
  sq.to_phone,
  NULL,
  NULL,
  sq.status,
  NULL,
  NULL,
  NULL,
  sq.sent_at,
  sq.created_at,
  sq.actor_user_id,
  sq.actor_role,
  sq.correlation_id,
  NULL,
  NULL,
  sq.to_user_id,
  sq.error_message
FROM public.sms_queue sq

UNION ALL
SELECT
  ('notification:' || no.id::text),
  no.id,
  'notification',
  'outbound',
  no.to_email,
  NULL,
  no.subject,
  no.event_type,
  no.status,
  NULL,
  NULL,
  NULL,
  no.sent_at,
  no.created_at,
  no.actor_user_id,
  no.actor_role,
  no.correlation_id,
  no.entity_type,
  no.entity_id,
  NULL,
  no.error_message
FROM public.notification_outbox no

UNION ALL
SELECT
  ('inapp:' || n.id::text),
  n.id,
  'inapp',
  'outbound',
  NULL,
  NULL,
  n.title,
  n.type,
  CASE WHEN n.is_read THEN 'read' ELSE 'unread' END,
  NULL,
  NULL,
  NULL,
  NULL,
  n.created_at,
  NULL,
  NULL,
  NULL,
  NULL,
  n.link_id::text,
  n.user_id,
  NULL
FROM public.notifications n

UNION ALL
SELECT
  ('call:' || c.id::text),
  c.id,
  'call',
  CASE WHEN c.agent_id IS NOT NULL THEN 'outbound' ELSE 'inbound' END,
  NULL,
  NULL,
  c.outcome,
  NULL,
  c.outcome,
  c.ended_at,
  NULL,
  NULL,
  c.ended_at,
  c.created_at,
  c.agent_id,
  c.agent_portal,
  NULL,
  'crm_contact',
  c.contact_id::text,
  NULL,
  c.notes
FROM public.crm_call_logs c;

GRANT SELECT ON public.v_customer_communications TO authenticated;
GRANT SELECT ON public.v_customer_communications TO service_role;

COMMENT ON VIEW public.v_customer_communications IS
'Module 46 — Canonical unified communications feed (email, sms, notifications, in-app, calls). Client 360 timeline reads this view exclusively.';
