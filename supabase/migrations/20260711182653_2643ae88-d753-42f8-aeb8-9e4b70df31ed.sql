
CREATE OR REPLACE FUNCTION public.rpc_account_journal_write(
  p_target_table text,
  p_payload jsonb,
  p_event_key text DEFAULT NULL::text,
  p_correlation_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_user_id UUID := auth.uid();
  v_actor_role TEXT;
  v_actor_name TEXT;
  v_actor_email TEXT;
  v_event_key TEXT := p_event_key;
  v_correlation_id UUID := COALESCE(p_correlation_id, gen_random_uuid());
  v_new_id UUID;
  v_existing JSONB;
  v_payload JSONB := COALESCE(p_payload, '{}'::jsonb);
  v_client_id UUID;
  v_account_id UUID;
  v_order_id UUID;
  v_jwt_role TEXT;
  v_actor_override JSONB;
  v_visibility TEXT;
BEGIN
  PERFORM set_config('app.journal_gateway','on', true);

  BEGIN
    v_jwt_role := COALESCE((current_setting('request.jwt.claims', true))::jsonb->>'role', '');
  EXCEPTION WHEN OTHERS THEN
    v_jwt_role := '';
  END;

  IF v_actor_user_id IS NULL THEN
    v_actor_override := v_payload->'_actor';
    IF v_jwt_role = 'service_role' AND v_actor_override IS NOT NULL THEN
      v_actor_user_id := NULLIF(v_actor_override->>'user_id','')::uuid;
      v_actor_role   := COALESCE(NULLIF(v_actor_override->>'role',''), 'system');
      v_actor_name   := COALESCE(NULLIF(v_actor_override->>'name',''), 'system');
      v_actor_email  := NULLIF(v_actor_override->>'email','');
    END IF;
  END IF;

  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'JOURNAL-401: authentication required' USING ERRCODE = '42501';
  END IF;

  IF v_event_key IS NOT NULL THEN
    SELECT result INTO v_existing
      FROM public.account_journal_idempotency
      WHERE event_key = v_event_key
      LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'idempotent', true, 'result', v_existing);
    END IF;
  END IF;

  IF v_actor_role IS NULL OR v_actor_name IS NULL THEN
    SELECT
      COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.email, 'system'),
      p.email
      INTO v_actor_name, v_actor_email
      FROM public.profiles p WHERE p.id = v_actor_user_id;

    SELECT ur.role::text INTO v_actor_role
      FROM public.user_roles ur
      WHERE ur.user_id = v_actor_user_id
      ORDER BY CASE ur.role::text
        WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 ELSE 9 END
      LIMIT 1;
    v_actor_role := COALESCE(v_actor_role, 'authenticated');
  END IF;

  v_client_id  := NULLIF(v_payload->>'client_id','')::uuid;
  v_account_id := NULLIF(v_payload->>'account_id','')::uuid;
  v_order_id   := NULLIF(v_payload->>'order_id','')::uuid;
  v_visibility := NULLIF(v_payload->>'visibility','');

  v_payload := v_payload - '_actor';

  IF p_target_table NOT IN (
    'client_activity_logs','activity_logs','client_internal_notes',
    'account_followups','order_status_history','order_internal_notes',
    'client_admin_notes'
  ) THEN
    RAISE EXCEPTION 'JOURNAL-400: target_table % not allowed', p_target_table USING ERRCODE = '22023';
  END IF;

  IF p_target_table = 'client_admin_notes' THEN
    IF v_actor_role <> 'admin' AND v_jwt_role <> 'service_role' THEN
      RAISE EXCEPTION 'JOURNAL-403: admin role required for client_admin_notes' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_target_table = 'client_activity_logs' THEN
    INSERT INTO public.client_activity_logs(
      client_id, actor_user_id, actor_name, actor_role,
      action_type, entity_type, entity_id, summary,
      before_data, after_data, correlation_id, event_key, metadata, visibility
    ) VALUES (
      v_client_id, v_actor_user_id, v_actor_name, v_actor_role,
      COALESCE(v_payload->>'action_type','note'),
      v_payload->>'entity_type',
      NULLIF(v_payload->>'entity_id','')::uuid,
      v_payload->>'summary',
      v_payload->'before_data', v_payload->'after_data',
      v_correlation_id, v_event_key, COALESCE(v_payload->'metadata','{}'::jsonb),
      COALESCE(v_visibility, 'client')
    ) RETURNING id INTO v_new_id;

  ELSIF p_target_table = 'activity_logs' THEN
    INSERT INTO public.activity_logs(
      user_id, action, entity_type, entity_id, details,
      actor_role, actor_name, actor_email,
      changed_field, reason, old_value, new_value,
      correlation_id, event_key, metadata, visibility
    ) VALUES (
      v_actor_user_id,
      COALESCE(v_payload->>'action','write'),
      v_payload->>'entity_type',
      NULLIF(v_payload->>'entity_id','')::uuid,
      COALESCE(v_payload->'details','{}'::jsonb),
      v_actor_role, v_actor_name, v_actor_email,
      v_payload->>'changed_field',
      v_payload->>'reason',
      v_payload->>'old_value',
      v_payload->>'new_value',
      v_correlation_id, v_event_key, COALESCE(v_payload->'metadata','{}'::jsonb),
      COALESCE(v_visibility, 'admin')
    ) RETURNING id INTO v_new_id;

  ELSIF p_target_table = 'client_internal_notes' THEN
    INSERT INTO public.client_internal_notes(
      client_id, account_id, created_by_user_id, created_by_name, created_by_role,
      note_type, body, correlation_id, event_key, metadata, visibility
    ) VALUES (
      v_client_id, v_account_id, v_actor_user_id, v_actor_name, v_actor_role,
      COALESCE(v_payload->>'note_type','general'),
      COALESCE(v_payload->>'body',''),
      v_correlation_id, v_event_key,
      COALESCE(v_payload->'metadata','{}'::jsonb),
      COALESCE(v_visibility, 'staff')
    ) RETURNING id INTO v_new_id;

  ELSIF p_target_table = 'client_admin_notes' THEN
    INSERT INTO public.client_admin_notes(
      client_id, note, created_by
    ) VALUES (
      v_client_id, COALESCE(v_payload->>'note', v_payload->>'body',''), v_actor_user_id
    ) RETURNING id INTO v_new_id;

  ELSIF p_target_table = 'account_followups' THEN
    INSERT INTO public.account_followups(
      account_id, client_id, created_by, assigned_to,
      category, priority, subject, description, due_at, status,
      correlation_id, event_key
    ) VALUES (
      v_account_id, v_client_id, v_actor_user_id,
      NULLIF(v_payload->>'assigned_to','')::uuid,
      COALESCE(v_payload->>'category','followup'),
      COALESCE(v_payload->>'priority','normal'),
      v_payload->>'subject',
      v_payload->>'description',
      NULLIF(v_payload->>'due_at','')::timestamptz,
      COALESCE(v_payload->>'status','open'),
      v_correlation_id, v_event_key
    ) RETURNING id INTO v_new_id;

  ELSIF p_target_table = 'order_status_history' THEN
    INSERT INTO public.order_status_history(
      order_id, changed_by, old_status, new_status, reason,
      correlation_id, event_key
    ) VALUES (
      v_order_id, v_actor_user_id,
      v_payload->>'old_status',
      COALESCE(v_payload->>'new_status',''),
      v_payload->>'reason',
      v_correlation_id, v_event_key
    ) RETURNING id INTO v_new_id;

  ELSIF p_target_table = 'order_internal_notes' THEN
    INSERT INTO public.order_internal_notes(
      order_id, created_by_user_id, created_by_name, created_by_role, body,
      correlation_id, event_key
    ) VALUES (
      v_order_id, v_actor_user_id, v_actor_name, COALESCE(v_actor_role,'admin'),
      COALESCE(v_payload->>'body',''),
      v_correlation_id, v_event_key
    ) RETURNING id INTO v_new_id;
  END IF;

  INSERT INTO public.account_journal_idempotency(event_key, target_table, correlation_id, actor_user_id, result)
  VALUES (COALESCE(v_event_key, v_correlation_id::text), p_target_table, v_correlation_id, v_actor_user_id,
          jsonb_build_object('id', v_new_id, 'correlation_id', v_correlation_id, 'event_key', v_event_key))
  ON CONFLICT (event_key) DO NOTHING;

  RETURN jsonb_build_object(
    'ok', true, 'idempotent', false, 'id', v_new_id,
    'correlation_id', v_correlation_id, 'event_key', v_event_key
  );
END;
$function$;

CREATE OR REPLACE VIEW public.v_account_nps_score
WITH (security_invoker=on)
AS
WITH latest AS (
  SELECT DISTINCT ON (client_id)
    client_id, account_id, score, category, comment, responded_at, sent_at
  FROM public.nps_surveys
  WHERE responded_at IS NOT NULL AND client_id IS NOT NULL
  ORDER BY client_id, responded_at DESC
),
agg AS (
  SELECT
    client_id,
    AVG(score)::numeric(4,2) AS avg_score_all,
    AVG(score) FILTER (WHERE responded_at > now() - interval '12 months')::numeric(4,2) AS avg_score_12m,
    COUNT(*) AS response_count,
    COUNT(*) FILTER (WHERE category = 'promoter')  AS promoter_count,
    COUNT(*) FILTER (WHERE category = 'passive')   AS passive_count,
    COUNT(*) FILTER (WHERE category = 'detractor') AS detractor_count,
    MAX(responded_at) AS last_response_at,
    MIN(responded_at) AS first_response_at
  FROM public.nps_surveys
  WHERE responded_at IS NOT NULL AND client_id IS NOT NULL
  GROUP BY client_id
)
SELECT
  a.client_id, l.account_id,
  l.score AS last_score, l.category AS last_category, l.comment AS last_comment,
  l.responded_at AS last_response_at,
  a.avg_score_all, a.avg_score_12m,
  a.response_count, a.promoter_count, a.passive_count, a.detractor_count,
  a.first_response_at
FROM agg a
LEFT JOIN latest l USING (client_id);

GRANT SELECT ON public.v_account_nps_score TO authenticated;
GRANT SELECT ON public.v_account_nps_score TO service_role;

CREATE OR REPLACE VIEW public.v_customer_timeline
WITH (security_invoker=on)
AS
WITH raw AS (
  SELECT cal.id AS event_id, cal.client_id, NULL::uuid AS account_id, cal.created_at AS occurred_at,
         'activity'::text AS event_type, 'info'::text AS severity,
         COALESCE(cal.summary, cal.action_type, 'Activité')::text AS summary,
         COALESCE(cal.actor_name, 'Système')::text AS actor_name,
         COALESCE(cal.actor_role, 'system')::text AS actor_role,
         'client_activity_logs'::text AS source_table, cal.id::text AS source_id,
         cal.correlation_id, cal.visibility, 100 AS dedup_priority, to_jsonb(cal.*) AS details
    FROM client_activity_logs cal
  UNION ALL
  SELECT cin.id, cin.client_id, cin.account_id, cin.created_at,
         'note'::text, 'info'::text,
         (COALESCE(NULLIF(cin.note_type,''), 'note') || ': ' || LEFT(cin.body, 140))::text,
         COALESCE(cin.created_by_name, 'Staff')::text,
         COALESCE(cin.created_by_role, 'staff')::text,
         'client_internal_notes'::text, cin.id::text,
         cin.correlation_id, cin.visibility, 90, to_jsonb(cin.*)
    FROM client_internal_notes cin
  UNION ALL
  SELECT can2.id, can2.client_id, NULL::uuid, can2.created_at,
         'admin_note'::text, 'info'::text,
         ('Note admin: ' || LEFT(can2.note, 140))::text,
         COALESCE(p.email, 'Admin')::text, 'admin'::text,
         'client_admin_notes'::text, can2.id::text,
         NULL::uuid, 'admin'::text, 85, to_jsonb(can2.*)
    FROM client_admin_notes can2
    LEFT JOIN profiles p ON p.user_id = can2.created_by
  UNION ALL
  SELECT af.id, af.client_user_id, af.account_id, af.created_at,
         'followup'::text,
         CASE af.priority WHEN 'high' THEN 'warning' WHEN 'urgent' THEN 'error' ELSE 'info' END::text,
         COALESCE(af.title, 'Suivi')::text,
         COALESCE(af.created_by_email, 'Staff')::text, 'staff'::text,
         'account_followups'::text, af.id::text,
         af.correlation_id, af.visibility, 80, to_jsonb(af.*)
    FROM account_followups af
  UNION ALL
  SELECT oin.id, o.user_id, NULL::uuid, oin.created_at,
         'order_note'::text, 'info'::text,
         ('Note commande #' || COALESCE(o.order_number,'?') || ': ' || LEFT(oin.body, 140))::text,
         COALESCE(oin.created_by_name, 'Staff')::text,
         COALESCE(oin.created_by_role, 'staff')::text,
         'order_internal_notes'::text, oin.id::text,
         oin.correlation_id, 'staff'::text, 85, to_jsonb(oin.*)
    FROM order_internal_notes oin
    JOIN orders o ON o.id = oin.order_id
  UNION ALL
  SELECT al.id, al.user_id, NULL::uuid, al.created_at,
         'audit'::text, 'info'::text,
         COALESCE(al.action, 'Audit')::text,
         COALESCE(al.actor_name, 'Système')::text,
         COALESCE(al.actor_role, 'system')::text,
         'activity_logs'::text, al.id::text,
         al.correlation_id, al.visibility, 50, to_jsonb(al.*)
    FROM activity_logs al
  UNION ALL
  SELECT bp.id, bp.customer_id, NULL::uuid, bp.created_at,
         'payment'::text,
         CASE bp.status::text WHEN 'completed' THEN 'success' WHEN 'failed' THEN 'error' ELSE 'info' END::text,
         ('Paiement ' || COALESCE(bp.status::text,'') || ' — ' || COALESCE(bp.amount::text,'0') || '$')::text,
         COALESCE(bp.created_by_name, 'Système')::text,
         COALESCE(bp.created_by_role, 'system')::text,
         'billing_payments'::text, bp.id::text,
         NULL::uuid, 'client'::text, 70, to_jsonb(bp.*)
    FROM billing_payments bp
  UNION ALL
  SELECT st.id, st.user_id, st.account_id, st.created_at,
         'support'::text, 'info'::text,
         ('Ticket #' || COALESCE(st.ticket_number,'') || ' — ' || COALESCE(st.subject,''))::text,
         COALESCE(st.client_name, 'Client')::text, 'client'::text,
         'support_tickets'::text, st.id::text,
         NULL::uuid, 'client'::text, 70, to_jsonb(st.*)
    FROM support_tickets st
  UNION ALL
  SELECT cre.id, cre.actor_id, NULL::uuid, cre.created_at,
         'referral'::text, 'info'::text,
         COALESCE(cre.event_type, 'Parrainage')::text,
         'Système'::text, 'system'::text,
         'client_referral_events'::text, cre.id::text,
         NULL::uuid, 'client'::text, 60, to_jsonb(cre.*)
    FROM client_referral_events cre
  UNION ALL
  SELECT bsta.id, bsta.customer_id, NULL::uuid, bsta.created_at,
         'billing'::text, 'info'::text,
         ('Abonnement — ' || COALESCE(bsta.action,''))::text,
         'Système'::text, 'system'::text,
         'billing_subscription_trace_audit'::text, bsta.id::text,
         NULL::uuid, 'staff'::text, 60, to_jsonb(bsta.*)
    FROM billing_subscription_trace_audit bsta
  UNION ALL
  SELECT afi.id, afi.client_id, afi.account_id, afi.created_at,
         'fraud'::text,
         CASE afi.severity WHEN 'critical' THEN 'error' WHEN 'high' THEN 'warning' WHEN 'medium' THEN 'warning' ELSE 'info' END::text,
         ('Incident fraude — ' || COALESCE(afi.severity,'') || ' — ' || LEFT(COALESCE(afi.description,''),140))::text,
         COALESCE(afi.created_by_email, 'Système')::text, 'admin'::text,
         'account_fraud_incidents'::text, afi.id::text,
         NULL::uuid, 'admin'::text, 75, to_jsonb(afi.*)
    FROM account_fraud_incidents afi
  UNION ALL
  SELECT sal.id, sal.client_id, NULL::uuid, sal.created_at,
         'security'::text, 'warning'::text,
         ('Sécurité — ' || COALESCE(sal.action,''))::text,
         COALESCE(sal.action_by_name, 'Staff')::text,
         COALESCE(sal.action_by_role, 'admin')::text,
         'security_action_logs'::text, sal.id::text,
         NULL::uuid, 'admin'::text, 75, to_jsonb(sal.*)
    FROM security_action_logs sal
  UNION ALL
  SELECT kr.id, kr.client_id, NULL::uuid, kr.created_at,
         'kyc'::text, 'info'::text,
         ('KYC — statut ' || COALESCE(kr.status,''))::text,
         'Système'::text, 'system'::text,
         'kyc_requests'::text, kr.id::text,
         NULL::uuid, 'admin'::text, 70, to_jsonb(kr.*)
    FROM kyc_requests kr
  UNION ALL
  SELECT cr.id, cr.subject_user_id, cr.account_id, cr.created_at,
         'consent'::text, 'info'::text,
         ('Consentement ' || COALESCE(cr.consent_type::text,'') || ' — ' || COALESCE(cr.status::text,''))::text,
         COALESCE(cr.recorded_by_email, 'Système')::text,
         COALESCE(cr.recorded_by_role, 'system')::text,
         'consent_records'::text, cr.id::text,
         NULL::uuid, 'admin'::text, 70, to_jsonb(cr.*)
    FROM consent_records cr
  UNION ALL
  SELECT pr.id, pr.client_id, pr.account_id, pr.created_at,
         'privacy'::text, 'info'::text,
         ('Demande vie privée — ' || COALESCE(pr.status,'') || ' — ' || LEFT(COALESCE(pr.description,''),140))::text,
         'Système'::text, 'admin'::text,
         'privacy_requests'::text, pr.id::text,
         NULL::uuid, 'admin'::text, 70, to_jsonb(pr.*)
    FROM privacy_requests pr
  UNION ALL
  SELECT dal.id, dal.target_user_id, NULL::uuid, dal.created_at,
         'document'::text, 'info'::text,
         ('Document — ' || COALESCE(dal.action,''))::text,
         COALESCE(dal.actor_role, 'system')::text,
         COALESCE(dal.actor_role, 'system')::text,
         'document_audit_log'::text, dal.id::text,
         NULL::uuid, 'admin'::text, 60, to_jsonb(dal.*)
    FROM document_audit_log dal
  UNION ALL
  SELECT ns.id, ns.client_id, ns.account_id, ns.responded_at,
         'nps'::text,
         CASE ns.category WHEN 'promoter' THEN 'success' WHEN 'detractor' THEN 'error' ELSE 'info' END::text,
         ('NPS ' || COALESCE(ns.category,'—') || ' — score ' || COALESCE(ns.score::text,'?') ||
          CASE WHEN ns.comment IS NOT NULL THEN ' — ' || LEFT(ns.comment, 100) ELSE '' END)::text,
         'Client'::text, 'client'::text,
         'nps_surveys'::text, ns.id::text,
         NULL::uuid, 'staff'::text, 65, to_jsonb(ns.*)
    FROM nps_surveys ns
    WHERE ns.responded_at IS NOT NULL
),
dedup AS (
  SELECT r.*,
    CASE WHEN r.correlation_id IS NULL THEN 1::bigint
         ELSE row_number() OVER (PARTITION BY r.correlation_id ORDER BY r.dedup_priority DESC, r.occurred_at DESC)
    END AS rn
  FROM raw r
)
SELECT event_id, client_id, account_id, occurred_at, event_type, severity, summary,
       actor_name, actor_role, source_table, source_id, details, correlation_id, visibility
FROM dedup
WHERE rn = 1;

GRANT SELECT ON public.v_customer_timeline TO authenticated;
GRANT SELECT ON public.v_customer_timeline TO service_role;

CREATE TABLE IF NOT EXISTS public.qa_module47_e2e_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  step_name text NOT NULL,
  status text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.qa_module47_e2e_log TO authenticated;
GRANT ALL ON public.qa_module47_e2e_log TO service_role;

ALTER TABLE public.qa_module47_e2e_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qa_module47_admin_read" ON public.qa_module47_e2e_log;
CREATE POLICY "qa_module47_admin_read"
  ON public.qa_module47_e2e_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
