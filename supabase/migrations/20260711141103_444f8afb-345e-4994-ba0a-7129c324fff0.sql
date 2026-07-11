
-- ============================================================================
-- Module 44 Phase 2 — Timeline Client 360 canonique + visibility contract
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE public.client_activity_logs
    ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'client'
      CHECK (visibility IN ('client','staff','admin'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.client_internal_notes
    ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'staff'
      CHECK (visibility IN ('client','staff','admin'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.account_followups
    ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'staff'
      CHECK (visibility IN ('client','staff','admin'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.activity_logs
    ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'admin'
      CHECK (visibility IN ('client','staff','admin'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_client_activity_logs_client_created
  ON public.client_activity_logs (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_internal_notes_client_created
  ON public.client_internal_notes (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_followups_client_created
  ON public.account_followups (client_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created
  ON public.activity_logs (user_id, created_at DESC);

DROP VIEW IF EXISTS public.v_customer_timeline_client CASCADE;
DROP VIEW IF EXISTS public.v_customer_timeline CASCADE;

CREATE VIEW public.v_customer_timeline
WITH (security_invoker=on) AS
WITH raw AS (
  SELECT
    cal.id AS event_id, cal.client_id, NULL::uuid AS account_id, cal.created_at AS occurred_at,
    'activity'::text AS event_type, 'info'::text AS severity,
    COALESCE(cal.summary, cal.action_type, 'Activité') AS summary,
    COALESCE(cal.actor_name, 'Système') AS actor_name,
    COALESCE(cal.actor_role, 'system') AS actor_role,
    'client_activity_logs'::text AS source_table, cal.id::text AS source_id,
    cal.correlation_id, cal.visibility, 100 AS dedup_priority,
    to_jsonb(cal) AS details
  FROM public.client_activity_logs cal
  UNION ALL
  SELECT cin.id, cin.client_id, cin.account_id, cin.created_at,
    'note', 'info',
    COALESCE(NULLIF(cin.note_type,''),'note') || ': ' || left(cin.body,140),
    COALESCE(cin.created_by_name,'Staff'), COALESCE(cin.created_by_role,'staff'),
    'client_internal_notes', cin.id::text, cin.correlation_id, cin.visibility, 90, to_jsonb(cin)
  FROM public.client_internal_notes cin
  UNION ALL
  SELECT af.id, af.client_user_id, af.account_id, af.created_at,
    'followup',
    CASE af.priority WHEN 'high' THEN 'warning' WHEN 'urgent' THEN 'error' ELSE 'info' END,
    COALESCE(af.title,'Suivi'),
    COALESCE(af.created_by_email,'Staff'), 'staff',
    'account_followups', af.id::text, af.correlation_id, af.visibility, 80, to_jsonb(af)
  FROM public.account_followups af
  UNION ALL
  SELECT al.id, al.user_id, NULL::uuid, al.created_at,
    'audit', 'info', COALESCE(al.action,'Audit'),
    COALESCE(al.actor_name,'Système'), COALESCE(al.actor_role,'system'),
    'activity_logs', al.id::text, al.correlation_id, al.visibility, 50, to_jsonb(al)
  FROM public.activity_logs al
  UNION ALL
  SELECT bp.id, bp.customer_id, NULL::uuid, bp.created_at,
    'payment',
    CASE bp.status::text WHEN 'completed' THEN 'success' WHEN 'failed' THEN 'error' ELSE 'info' END,
    'Paiement ' || COALESCE(bp.status::text,'') || ' — ' || COALESCE(bp.amount::text,'0') || '$',
    COALESCE(bp.created_by_name,'Système'), COALESCE(bp.created_by_role,'system'),
    'billing_payments', bp.id::text, NULL::uuid, 'client'::text, 70, to_jsonb(bp)
  FROM public.billing_payments bp
  UNION ALL
  SELECT st.id, st.user_id, st.account_id, st.created_at,
    'support', 'info',
    'Ticket #' || COALESCE(st.ticket_number,'') || ' — ' || COALESCE(st.subject,''),
    COALESCE(st.client_name,'Client'), 'client',
    'support_tickets', st.id::text, NULL::uuid, 'client'::text, 70, to_jsonb(st)
  FROM public.support_tickets st
  UNION ALL
  SELECT cre.id, cre.actor_id, NULL::uuid, cre.created_at,
    'referral', 'info', COALESCE(cre.event_type,'Parrainage'),
    'Système', 'system',
    'client_referral_events', cre.id::text, NULL::uuid, 'client'::text, 60, to_jsonb(cre)
  FROM public.client_referral_events cre
  UNION ALL
  SELECT bsta.id, bsta.customer_id, NULL::uuid, bsta.created_at,
    'billing', 'info', 'Abonnement — ' || COALESCE(bsta.action,''),
    'Système', 'system',
    'billing_subscription_trace_audit', bsta.id::text, NULL::uuid, 'staff'::text, 60, to_jsonb(bsta)
  FROM public.billing_subscription_trace_audit bsta
  UNION ALL
  SELECT afi.id, afi.client_id, afi.account_id, afi.created_at,
    'fraud',
    CASE afi.severity WHEN 'critical' THEN 'error' WHEN 'high' THEN 'warning' WHEN 'medium' THEN 'warning' ELSE 'info' END,
    'Incident fraude — ' || COALESCE(afi.severity,'') || ' — ' || left(COALESCE(afi.description,''),140),
    COALESCE(afi.created_by_email,'Système'), 'admin',
    'account_fraud_incidents', afi.id::text, NULL::uuid, 'admin'::text, 75, to_jsonb(afi)
  FROM public.account_fraud_incidents afi
  UNION ALL
  SELECT sal.id, sal.client_id, NULL::uuid, sal.created_at,
    'security', 'warning', 'Sécurité — ' || COALESCE(sal.action,''),
    COALESCE(sal.action_by_name,'Staff'), COALESCE(sal.action_by_role,'admin'),
    'security_action_logs', sal.id::text, NULL::uuid, 'admin'::text, 75, to_jsonb(sal)
  FROM public.security_action_logs sal
  UNION ALL
  SELECT kr.id, kr.client_id, NULL::uuid, kr.created_at,
    'kyc', 'info', 'KYC — statut ' || COALESCE(kr.status,''),
    'Système', 'system',
    'kyc_requests', kr.id::text, NULL::uuid, 'admin'::text, 70, to_jsonb(kr)
  FROM public.kyc_requests kr
  UNION ALL
  SELECT cr.id, cr.subject_user_id, cr.account_id, cr.created_at,
    'consent', 'info',
    'Consentement ' || COALESCE(cr.consent_type::text,'') || ' — ' || COALESCE(cr.status::text,''),
    COALESCE(cr.recorded_by_email,'Système'), COALESCE(cr.recorded_by_role,'system'),
    'consent_records', cr.id::text, NULL::uuid, 'admin'::text, 70, to_jsonb(cr)
  FROM public.consent_records cr
  UNION ALL
  SELECT pr.id, pr.client_id, pr.account_id, pr.created_at,
    'privacy', 'info',
    'Demande vie privée — ' || COALESCE(pr.status,'') || ' — ' || left(COALESCE(pr.description,''),140),
    'Système', 'admin',
    'privacy_requests', pr.id::text, NULL::uuid, 'admin'::text, 70, to_jsonb(pr)
  FROM public.privacy_requests pr
  UNION ALL
  SELECT dal.id, dal.target_user_id, NULL::uuid, dal.created_at,
    'document', 'info', 'Document — ' || COALESCE(dal.action,''),
    COALESCE(dal.actor_role,'system'), COALESCE(dal.actor_role,'system'),
    'document_audit_log', dal.id::text, NULL::uuid, 'admin'::text, 60, to_jsonb(dal)
  FROM public.document_audit_log dal
),
dedup AS (
  SELECT r.*,
    CASE WHEN r.correlation_id IS NULL THEN 1
    ELSE ROW_NUMBER() OVER (PARTITION BY r.correlation_id ORDER BY r.dedup_priority DESC, r.occurred_at ASC)
    END AS rn
  FROM raw r
)
SELECT event_id, client_id, account_id, occurred_at,
       event_type, severity, summary, actor_name, actor_role,
       source_table, source_id, details, correlation_id, visibility
FROM dedup
WHERE rn = 1 AND client_id IS NOT NULL;

COMMENT ON VIEW public.v_customer_timeline IS
  'Module 44 canonical timeline. Unions 13 sources with correlation_id dedup. security_invoker=on — caller RLS applies.';

GRANT SELECT ON public.v_customer_timeline TO authenticated, service_role;

CREATE VIEW public.v_customer_timeline_client
WITH (security_invoker=on) AS
SELECT
  event_id, client_id, account_id, occurred_at,
  event_type, severity, summary, actor_name,
  source_table, source_id,
  jsonb_strip_nulls(jsonb_build_object(
    'event_type', event_type,
    'severity', severity,
    'summary', summary,
    'occurred_at', occurred_at
  )) AS details
FROM public.v_customer_timeline
WHERE visibility = 'client'
  AND event_type NOT IN ('fraud','security','kyc','consent','privacy','audit','document');

COMMENT ON VIEW public.v_customer_timeline_client IS
  'Module 44 client-facing timeline. Only visibility=client, sensitive event types excluded, details stripped.';

GRANT SELECT ON public.v_customer_timeline_client TO authenticated, service_role;
