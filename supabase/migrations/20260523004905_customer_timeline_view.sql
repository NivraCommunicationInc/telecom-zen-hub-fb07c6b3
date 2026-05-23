-- ==============================================================================
-- CUSTOMER TIMELINE — Unified chronological view of events for a client.
-- ==============================================================================
-- Problème résolu:
--   Le Customer Service portail interroge aujourd'hui 5+ tables différentes pour
--   reconstruire l'historique d'un client (activity_logs, internal_audit_log,
--   billing_subscription_trace_audit, billing_payments, support_tickets,
--   cancellation_runs...). Chaque endroit affiche ces données différemment.
--
-- Solution:
--   Une vue `v_customer_timeline` qui UNION ALL 6 sources de référence et les
--   projette dans une forme commune. Le CSR peut alors faire UN query et voir
--   l'historique complet du client en ordre chronologique.
--
-- Shape:
--   event_id        text          — id stable composite (table + uuid)
--   client_id       uuid          — auth.users.id du client
--   account_id      uuid          — accounts.id (peut être NULL si l'event ne le sait pas)
--   occurred_at     timestamptz   — quand l'événement s'est produit
--   event_type      text          — catégorie ('billing'|'support'|'cancellation'|'audit'|'payment'|'system')
--   severity        text          — 'info' | 'success' | 'warning' | 'error'
--   summary         text          — résumé court (1 ligne, lisible)
--   actor_name      text          — qui a fait l'action
--   actor_role      text          — admin/employee/system/client/...
--   source_table    text          — nom de la table d'origine
--   source_id       text          — id original (peut être uuid ou autre)
--   details         jsonb         — payload brut pour drill-down
-- ==============================================================================

CREATE OR REPLACE VIEW public.v_customer_timeline
WITH (security_invoker = on)
AS
-- 1. Generic activity_logs (broad-purpose action log)
SELECT
  'activity_log:' || al.id::text         AS event_id,
  COALESCE(al.user_id, al.entity_id::uuid) AS client_id,
  NULL::uuid                              AS account_id,
  al.created_at                           AS occurred_at,
  'audit'                                 AS event_type,
  'info'                                  AS severity,
  COALESCE(al.action, 'activity')         AS summary,
  COALESCE(al.actor_name, 'System')       AS actor_name,
  COALESCE(al.actor_role, 'system')       AS actor_role,
  'activity_logs'                         AS source_table,
  al.id::text                             AS source_id,
  COALESCE(al.details, '{}'::jsonb)       AS details
FROM public.activity_logs al
WHERE al.user_id IS NOT NULL OR al.entity_type IN ('client', 'profile', 'account')

UNION ALL

-- 2. Subscription lifecycle (every status change has a row here)
SELECT
  'sub_trace:' || sta.id::text                          AS event_id,
  bc.user_id                                            AS client_id,
  NULL::uuid                                            AS account_id,
  sta.created_at                                        AS occurred_at,
  'billing'                                             AS event_type,
  CASE
    WHEN sta.action ILIKE '%cancel%' OR sta.action ILIKE '%suspend%' THEN 'warning'
    WHEN sta.action ILIKE '%activat%' OR sta.action ILIKE '%paid%'   THEN 'success'
    ELSE 'info'
  END                                                   AS severity,
  COALESCE(sta.reason, sta.action)                      AS summary,
  'System'                                              AS actor_name,
  COALESCE(sta.source_type, 'system')                   AS actor_role,
  'billing_subscription_trace_audit'                    AS source_table,
  sta.id::text                                          AS source_id,
  COALESCE(sta.details, '{}'::jsonb)                    AS details
FROM public.billing_subscription_trace_audit sta
LEFT JOIN public.billing_customers bc ON bc.id = sta.customer_id
WHERE bc.user_id IS NOT NULL

UNION ALL

-- 3. Cancellation runs (the new orchestrated cancellation log)
SELECT
  'cancel_run:' || cr.id::text                          AS event_id,
  a.client_id                                           AS client_id,
  cr.account_id                                         AS account_id,
  cr.started_at                                         AS occurred_at,
  'cancellation'                                        AS event_type,
  CASE
    WHEN cr.status = 'completed'              THEN 'warning'
    WHEN cr.status = 'completed_with_errors'  THEN 'error'
    WHEN cr.status = 'failed'                 THEN 'error'
    ELSE 'info'
  END                                                   AS severity,
  CASE cr.scope
    WHEN 'full'    THEN format('Account closure (%s subs cancelled, %s invoices voided)',
                               cr.subscriptions_cancelled, cr.invoices_voided)
    ELSE            format('Service cancellation (%s subs cancelled)', cr.subscriptions_cancelled)
  END                                                   AS summary,
  COALESCE(cr.initiated_by_email, 'System')             AS actor_name,
  COALESCE(cr.initiated_by_role, 'system')              AS actor_role,
  'cancellation_runs'                                   AS source_table,
  cr.id::text                                           AS source_id,
  jsonb_build_object(
    'scope', cr.scope,
    'reason', cr.reason,
    'status', cr.status,
    'paypal_cancellations', cr.paypal_cancellations,
    'subscriptions_cancelled', cr.subscriptions_cancelled,
    'invoices_voided', cr.invoices_voided
  )                                                     AS details
FROM public.cancellation_runs cr
JOIN public.accounts a ON a.id = cr.account_id

UNION ALL

-- 4. Payments received (every dollar in)
SELECT
  'payment:' || bp.id::text                             AS event_id,
  bc.user_id                                            AS client_id,
  NULL::uuid                                            AS account_id,
  COALESCE(bp.processed_at, bp.created_at)              AS occurred_at,
  'payment'                                             AS event_type,
  CASE bp.status
    WHEN 'confirmed' THEN 'success'
    WHEN 'failed'    THEN 'error'
    WHEN 'refunded'  THEN 'warning'
    ELSE 'info'
  END                                                   AS severity,
  format('Payment %s — $%s (%s)',
         bp.status,
         to_char(bp.amount, 'FM999990.00'),
         COALESCE(bp.payment_method, 'unknown'))        AS summary,
  COALESCE(bp.created_by_name, 'System')                AS actor_name,
  COALESCE(bp.created_by_role, 'system')                AS actor_role,
  'billing_payments'                                    AS source_table,
  bp.id::text                                           AS source_id,
  jsonb_build_object(
    'amount', bp.amount,
    'status', bp.status,
    'method', bp.payment_method,
    'provider_payment_id', bp.provider_payment_id,
    'invoice_id', bp.invoice_id
  )                                                     AS details
FROM public.billing_payments bp
LEFT JOIN public.billing_customers bc ON bc.id = bp.customer_id
WHERE bc.user_id IS NOT NULL

UNION ALL

-- 5. Support tickets (each ticket created = a touchpoint)
SELECT
  'ticket:' || st.id::text                              AS event_id,
  st.user_id                                            AS client_id,
  NULL::uuid                                            AS account_id,
  st.created_at                                         AS occurred_at,
  'support'                                             AS event_type,
  CASE st.priority
    WHEN 'urgent' THEN 'error'
    WHEN 'high'   THEN 'warning'
    ELSE 'info'
  END                                                   AS severity,
  format('[%s] %s', COALESCE(st.priority, 'normal'), COALESCE(st.subject, 'Ticket created')) AS summary,
  COALESCE(st.created_by_name, 'Client')                AS actor_name,
  CASE WHEN st.created_by_user_id = st.user_id THEN 'client' ELSE 'staff' END AS actor_role,
  'support_tickets'                                     AS source_table,
  st.id::text                                           AS source_id,
  jsonb_build_object(
    'ticket_number', st.ticket_number,
    'status', st.status,
    'priority', st.priority,
    'category', st.category
  )                                                     AS details
FROM public.support_tickets st
WHERE st.user_id IS NOT NULL

UNION ALL

-- 6. Referral milestones (when a client converts a referral)
SELECT
  'referral_event:' || cre.id::text                     AS event_id,
  cre.client_id                                         AS client_id,
  NULL::uuid                                            AS account_id,
  cre.created_at                                        AS occurred_at,
  'billing'                                             AS event_type,
  'success'                                             AS severity,
  COALESCE(cre.event_type, 'Referral event')            AS summary,
  'System'                                              AS actor_name,
  'system'                                              AS actor_role,
  'client_referral_events'                              AS source_table,
  cre.id::text                                          AS source_id,
  COALESCE(cre.details, '{}'::jsonb)                    AS details
FROM public.client_referral_events cre;

-- ──────────────────────────────────────────────────────────────────────────────
-- PERMISSIONS — RLS is enforced via security_invoker on the view: each user
-- sees only rows their session has SELECT on in the underlying tables.
-- ──────────────────────────────────────────────────────────────────────────────
GRANT SELECT ON public.v_customer_timeline TO authenticated, service_role;

INSERT INTO public.security_events (event_type, severity, details)
VALUES (
  'CUSTOMER_TIMELINE_VIEW_INSTALLED',
  'info',
  jsonb_build_object(
    'description', 'v_customer_timeline aggregates 6 sources into one chronological per-client log',
    'sources', ARRAY[
      'activity_logs',
      'billing_subscription_trace_audit',
      'cancellation_runs',
      'billing_payments',
      'support_tickets',
      'client_referral_events'
    ],
    'applied_at', now()
  )
);
