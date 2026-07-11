CREATE OR REPLACE VIEW public.v_customer_timeline AS WITH raw AS (
         SELECT cal.id AS event_id, cal.client_id, NULL::uuid AS account_id, cal.created_at AS occurred_at,
            'activity'::text AS event_type, 'info'::text AS severity,
            COALESCE(cal.summary, cal.action_type, 'Activité'::text) AS summary,
            COALESCE(cal.actor_name, 'Système'::text) AS actor_name,
            COALESCE(cal.actor_role, 'system'::text) AS actor_role,
            'client_activity_logs'::text AS source_table, (cal.id)::text AS source_id,
            cal.correlation_id, cal.visibility, 100 AS dedup_priority, to_jsonb(cal.*) AS details
           FROM client_activity_logs cal
        UNION ALL
         SELECT cin.id, cin.client_id, cin.account_id, cin.created_at, 'note'::text, 'info'::text,
            ((COALESCE(NULLIF(cin.note_type, ''::text), 'note'::text) || ': '::text) || "left"(cin.body, 140)),
            COALESCE(cin.created_by_name, 'Staff'::text),
            COALESCE(cin.created_by_role, 'staff'::text),
            'client_internal_notes'::text, (cin.id)::text, cin.correlation_id, cin.visibility, 90, to_jsonb(cin.*)
           FROM client_internal_notes cin
        UNION ALL
         SELECT can2.id, can2.client_id, NULL::uuid, can2.created_at, 'admin_note'::text, 'info'::text,
            ('Note admin: '::text || "left"(can2.note, 140)),
            COALESCE(p.email, 'Admin'::text), 'admin'::text,
            'client_admin_notes'::text, (can2.id)::text, NULL::uuid, 'admin'::text, 85, to_jsonb(can2.*)
           FROM (client_admin_notes can2 LEFT JOIN profiles p ON ((p.user_id = can2.created_by)))
        UNION ALL
         SELECT af.id, af.client_user_id, af.account_id, af.created_at, 'followup'::text,
                CASE af.priority WHEN 'high'::text THEN 'warning'::text WHEN 'urgent'::text THEN 'error'::text ELSE 'info'::text END,
            COALESCE(af.title, 'Suivi'::text), COALESCE(af.created_by_email, 'Staff'::text), 'staff'::text,
            'account_followups'::text, (af.id)::text, af.correlation_id, af.visibility, 80, to_jsonb(af.*)
           FROM account_followups af
        UNION ALL
         SELECT oin.id, o.user_id, NULL::uuid, oin.created_at, 'order_note'::text, 'info'::text,
            ((('Note commande #'::text || COALESCE(o.order_number, '?'::text)) || ': '::text) || "left"(oin.body, 140)),
            COALESCE(oin.created_by_name, 'Staff'::text), COALESCE(oin.created_by_role, 'staff'::text),
            'order_internal_notes'::text, (oin.id)::text, oin.correlation_id, 'staff'::text, 85, to_jsonb(oin.*)
           FROM (order_internal_notes oin JOIN orders o ON ((o.id = oin.order_id)))
        UNION ALL
         SELECT al.id, al.user_id, NULL::uuid, al.created_at, 'audit'::text, 'info'::text,
            COALESCE(al.action, 'Audit'::text), COALESCE(al.actor_name, 'Système'::text), COALESCE(al.actor_role, 'system'::text),
            'activity_logs'::text, (al.id)::text, al.correlation_id, al.visibility, 50, to_jsonb(al.*)
           FROM activity_logs al
        UNION ALL
         SELECT bp.id, bp.customer_id, NULL::uuid, bp.created_at, 'payment'::text,
                CASE (bp.status)::text WHEN 'completed'::text THEN 'success'::text WHEN 'failed'::text THEN 'error'::text ELSE 'info'::text END,
            (((('Paiement '::text || COALESCE((bp.status)::text, ''::text)) || ' — '::text) || COALESCE((bp.amount)::text, '0'::text)) || '$'::text),
            COALESCE(bp.created_by_name, 'Système'::text), COALESCE(bp.created_by_role, 'system'::text),
            'billing_payments'::text, (bp.id)::text, NULL::uuid, 'client'::text, 70, to_jsonb(bp.*)
           FROM billing_payments bp
        UNION ALL
         SELECT st.id, st.user_id, st.account_id, st.created_at, 'support'::text, 'info'::text,
            ((('Ticket #'::text || COALESCE(st.ticket_number, ''::text)) || ' — '::text) || COALESCE(st.subject, ''::text)),
            COALESCE(st.client_name, 'Client'::text), 'client'::text,
            'support_tickets'::text, (st.id)::text, NULL::uuid, 'client'::text, 70, to_jsonb(st.*)
           FROM support_tickets st
        UNION ALL
         SELECT cre.id, cre.actor_id, NULL::uuid, cre.created_at, 'referral'::text, 'info'::text,
            COALESCE(cre.event_type, 'Parrainage'::text), 'Système'::text, 'system'::text,
            'client_referral_events'::text, (cre.id)::text, NULL::uuid, 'client'::text, 60, to_jsonb(cre.*)
           FROM client_referral_events cre
        UNION ALL
         SELECT bsta.id, bsta.customer_id, NULL::uuid, bsta.created_at, 'billing'::text, 'info'::text,
            ('Abonnement — '::text || COALESCE(bsta.action, ''::text)), 'Système'::text, 'system'::text,
            'billing_subscription_trace_audit'::text, (bsta.id)::text, NULL::uuid, 'staff'::text, 60, to_jsonb(bsta.*)
           FROM billing_subscription_trace_audit bsta
        UNION ALL
         SELECT afi.id, afi.client_id, afi.account_id, afi.created_at, 'fraud'::text,
                CASE afi.severity WHEN 'critical'::text THEN 'error'::text WHEN 'high'::text THEN 'warning'::text WHEN 'medium'::text THEN 'warning'::text ELSE 'info'::text END,
            ((('Incident fraude — '::text || COALESCE(afi.severity, ''::text)) || ' — '::text) || "left"(COALESCE(afi.description, ''::text), 140)),
            COALESCE(afi.created_by_email, 'Système'::text), 'admin'::text,
            'account_fraud_incidents'::text, (afi.id)::text, NULL::uuid, 'admin'::text, 75, to_jsonb(afi.*)
           FROM account_fraud_incidents afi
        UNION ALL
         SELECT sal.id, sal.client_id, NULL::uuid, sal.created_at, 'security'::text, 'warning'::text,
            ('Sécurité — '::text || COALESCE(sal.action, ''::text)),
            COALESCE(sal.action_by_name, 'Staff'::text), COALESCE(sal.action_by_role, 'admin'::text),
            'security_action_logs'::text, (sal.id)::text, NULL::uuid, 'admin'::text, 75, to_jsonb(sal.*)
           FROM security_action_logs sal
        UNION ALL
         SELECT kr.id, kr.client_id, NULL::uuid, kr.created_at, 'kyc'::text, 'info'::text,
            ('KYC — statut '::text || COALESCE(kr.status, ''::text)), 'Système'::text, 'system'::text,
            'kyc_requests'::text, (kr.id)::text, NULL::uuid, 'admin'::text, 70, to_jsonb(kr.*)
           FROM kyc_requests kr
        UNION ALL
         SELECT cr.id, cr.subject_user_id, cr.account_id, cr.created_at, 'consent'::text, 'info'::text,
            ((('Consentement '::text || COALESCE((cr.consent_type)::text, ''::text)) || ' — '::text) || COALESCE((cr.status)::text, ''::text)),
            COALESCE(cr.recorded_by_email, 'Système'::text), COALESCE(cr.recorded_by_role, 'system'::text),
            'consent_records'::text, (cr.id)::text, NULL::uuid, 'admin'::text, 70, to_jsonb(cr.*)
           FROM consent_records cr
        UNION ALL
         SELECT pr.id, pr.client_id, pr.account_id, pr.created_at, 'privacy'::text, 'info'::text,
            ((('Demande vie privée — '::text || COALESCE(pr.status, ''::text)) || ' — '::text) || "left"(COALESCE(pr.description, ''::text), 140)),
            'Système'::text, 'admin'::text,
            'privacy_requests'::text, (pr.id)::text, NULL::uuid, 'admin'::text, 70, to_jsonb(pr.*)
           FROM privacy_requests pr
        UNION ALL
         SELECT dal.id, dal.target_user_id, NULL::uuid, dal.created_at, 'document'::text, 'info'::text,
            ('Document — '::text || COALESCE(dal.action, ''::text)),
            COALESCE(dal.actor_role, 'system'::text), COALESCE(dal.actor_role, 'system'::text),
            'document_audit_log'::text, (dal.id)::text, NULL::uuid, 'admin'::text, 60, to_jsonb(dal.*)
           FROM document_audit_log dal
        UNION ALL
         SELECT ns.id, ns.client_id, ns.account_id, ns.responded_at, 'nps'::text,
                CASE ns.category WHEN 'promoter'::text THEN 'success'::text WHEN 'detractor'::text THEN 'error'::text ELSE 'info'::text END,
            (((('NPS '::text || COALESCE(ns.category, '—'::text)) || ' — score '::text) || COALESCE((ns.score)::text, '?'::text)) ||
                CASE WHEN (ns.comment IS NOT NULL) THEN (' — '::text || "left"(ns.comment, 100)) ELSE ''::text END),
            'Client'::text, 'client'::text,
            'nps_surveys'::text, (ns.id)::text, NULL::uuid, 'staff'::text, 65, to_jsonb(ns.*)
           FROM nps_surveys ns
          WHERE (ns.responded_at IS NOT NULL)
        UNION ALL
         SELECT aot.id, NULL::uuid, aot.account_id, aot.updated_at, 'account_transfer'::text,
                CASE aot.status::text WHEN 'completed' THEN 'success'::text WHEN 'cancelled' THEN 'warning'::text WHEN 'rejected' THEN 'error'::text WHEN 'expired' THEN 'error'::text ELSE 'info'::text END,
            ('Transfert responsabilité: '::text || aot.status::text),
            'Système'::text, 'admin'::text,
            'account_ownership_transfers'::text, aot.id::text, aot.correlation_id, 'staff'::text, 75, to_jsonb(aot.*)
           FROM account_ownership_transfers aot
        ), dedup AS (
         SELECT r.event_id, r.client_id, r.account_id, r.occurred_at, r.event_type, r.severity, r.summary,
            r.actor_name, r.actor_role, r.source_table, r.source_id, r.correlation_id, r.visibility, r.dedup_priority, r.details,
                CASE WHEN (r.correlation_id IS NULL) THEN (1)::bigint
                     ELSE row_number() OVER (PARTITION BY r.correlation_id ORDER BY r.dedup_priority DESC, r.occurred_at DESC) END AS rn
           FROM raw r
        )
 SELECT event_id, client_id, account_id, occurred_at, event_type, severity, summary, actor_name, actor_role,
    source_table, source_id, details, correlation_id, visibility
   FROM dedup
  WHERE (rn = 1);