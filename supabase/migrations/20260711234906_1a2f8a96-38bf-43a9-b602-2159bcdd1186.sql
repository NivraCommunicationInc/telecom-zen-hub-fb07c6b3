
-- Module 51 Phase B2.1 + B2.2

-- ============================================================
-- B2.2: Fix actor_name resolution in journal gateway RPC
-- profiles.id != profiles.user_id in the vast majority of rows,
-- so the current lookup by p.id falls back to 'system'.
-- ============================================================
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

  -- B2.2 fix: prefer user_id lookup; fall back to id-based lookup for the
  -- rare legacy rows where profiles.id == auth.uid().
  IF v_actor_role IS NULL OR v_actor_name IS NULL THEN
    SELECT
      COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.email, 'system'),
      p.email
      INTO v_actor_name, v_actor_email
      FROM public.profiles p WHERE p.user_id = v_actor_user_id
      LIMIT 1;

    IF v_actor_name IS NULL OR v_actor_name = 'system' THEN
      SELECT
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.email, 'system'),
        p.email
        INTO v_actor_name, v_actor_email
        FROM public.profiles p WHERE p.id = v_actor_user_id
        LIMIT 1;
    END IF;

    v_actor_name  := COALESCE(v_actor_name, 'system');

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

-- ============================================================
-- B2.1: Extend v_customer_timeline with three history sources
-- ============================================================
CREATE OR REPLACE VIEW public.v_customer_timeline
WITH (security_invoker = on) AS
WITH raw AS (
  -- client_activity_logs
  SELECT cal.id AS event_id, cal.client_id, NULL::uuid AS account_id,
         cal.created_at AS occurred_at, 'activity'::text AS event_type, 'info'::text AS severity,
         COALESCE(cal.summary, cal.action_type, 'Activité') AS summary,
         COALESCE(cal.actor_name, 'Système') AS actor_name,
         COALESCE(cal.actor_role, 'system') AS actor_role,
         'client_activity_logs'::text AS source_table, cal.id::text AS source_id,
         cal.correlation_id, cal.visibility, 100 AS dedup_priority,
         to_jsonb(cal.*) AS details
    FROM client_activity_logs cal
  UNION ALL
  -- client_internal_notes
  SELECT cin.id, cin.client_id, cin.account_id, cin.created_at,
         'note', 'info',
         (COALESCE(NULLIF(cin.note_type,''),'note') || ': ') || left(cin.body,140),
         COALESCE(cin.created_by_name,'Staff'),
         COALESCE(cin.created_by_role,'staff'),
         'client_internal_notes', cin.id::text,
         cin.correlation_id, cin.visibility, 90, to_jsonb(cin.*)
    FROM client_internal_notes cin
  UNION ALL
  -- client_admin_notes
  SELECT can2.id, can2.client_id, NULL::uuid, can2.created_at,
         'admin_note','info',
         'Note admin: ' || left(can2.note,140),
         COALESCE(p.email,'Admin'),'admin',
         'client_admin_notes', can2.id::text, NULL::uuid,'admin',85, to_jsonb(can2.*)
    FROM client_admin_notes can2 LEFT JOIN profiles p ON p.user_id = can2.created_by
  UNION ALL
  -- account_followups
  SELECT af.id, af.client_user_id, af.account_id, af.created_at,
         'followup',
         CASE af.priority WHEN 'high' THEN 'warning' WHEN 'urgent' THEN 'error' ELSE 'info' END,
         COALESCE(af.title,'Suivi'),
         COALESCE(af.created_by_email,'Staff'),'staff',
         'account_followups', af.id::text, af.correlation_id, af.visibility, 80, to_jsonb(af.*)
    FROM account_followups af
  UNION ALL
  -- order_internal_notes
  SELECT oin.id, o.user_id, NULL::uuid, oin.created_at,
         'order_note','info',
         ('Note commande #' || COALESCE(o.order_number,'?')) || ': ' || left(oin.body,140),
         COALESCE(oin.created_by_name,'Staff'),
         COALESCE(oin.created_by_role,'staff'),
         'order_internal_notes', oin.id::text, oin.correlation_id, 'staff', 85, to_jsonb(oin.*)
    FROM order_internal_notes oin JOIN orders o ON o.id = oin.order_id
  UNION ALL
  -- activity_logs (audit)
  SELECT al.id, al.user_id, NULL::uuid, al.created_at,
         'audit','info',
         COALESCE(al.action,'Audit'),
         COALESCE(al.actor_name,'Système'),
         COALESCE(al.actor_role,'system'),
         'activity_logs', al.id::text, al.correlation_id, al.visibility, 50, to_jsonb(al.*)
    FROM activity_logs al
  UNION ALL
  -- billing_payments
  SELECT bp.id, bp.customer_id, NULL::uuid, bp.created_at,
         'payment',
         CASE bp.status::text WHEN 'completed' THEN 'success' WHEN 'failed' THEN 'error' ELSE 'info' END,
         (('Paiement ' || COALESCE(bp.status::text,'')) || ' — ' || COALESCE(bp.amount::text,'0')) || '$',
         COALESCE(bp.created_by_name,'Système'),
         COALESCE(bp.created_by_role,'system'),
         'billing_payments', bp.id::text, NULL::uuid, 'client', 70, to_jsonb(bp.*)
    FROM billing_payments bp
  UNION ALL
  -- support_tickets
  SELECT st.id, st.user_id, st.account_id, st.created_at,
         'support','info',
         ('Ticket #' || COALESCE(st.ticket_number,'')) || ' — ' || COALESCE(st.subject,''),
         COALESCE(st.client_name,'Client'),'client',
         'support_tickets', st.id::text, NULL::uuid, 'client', 70, to_jsonb(st.*)
    FROM support_tickets st
  UNION ALL
  -- client_referral_events
  SELECT cre.id, cre.actor_id, NULL::uuid, cre.created_at,
         'referral','info',
         COALESCE(cre.event_type,'Parrainage'),
         'Système','system',
         'client_referral_events', cre.id::text, NULL::uuid, 'client', 60, to_jsonb(cre.*)
    FROM client_referral_events cre
  UNION ALL
  -- billing_subscription_trace_audit
  SELECT bsta.id, bsta.customer_id, NULL::uuid, bsta.created_at,
         'billing','info',
         'Abonnement — ' || COALESCE(bsta.action,''),
         'Système','system',
         'billing_subscription_trace_audit', bsta.id::text, NULL::uuid, 'staff', 60, to_jsonb(bsta.*)
    FROM billing_subscription_trace_audit bsta
  UNION ALL
  -- account_fraud_incidents
  SELECT afi.id, afi.client_id, afi.account_id, afi.created_at,
         'fraud',
         CASE afi.severity WHEN 'critical' THEN 'error' WHEN 'high' THEN 'warning' WHEN 'medium' THEN 'warning' ELSE 'info' END,
         ('Incident fraude — ' || COALESCE(afi.severity,'')) || ' — ' || left(COALESCE(afi.description,''),140),
         COALESCE(afi.created_by_email,'Système'),'admin',
         'account_fraud_incidents', afi.id::text, NULL::uuid, 'admin', 75, to_jsonb(afi.*)
    FROM account_fraud_incidents afi
  UNION ALL
  -- security_action_logs
  SELECT sal.id, sal.client_id, NULL::uuid, sal.created_at,
         'security','warning',
         'Sécurité — ' || COALESCE(sal.action,''),
         COALESCE(sal.action_by_name,'Staff'),
         COALESCE(sal.action_by_role,'admin'),
         'security_action_logs', sal.id::text, NULL::uuid, 'admin', 75, to_jsonb(sal.*)
    FROM security_action_logs sal
  UNION ALL
  -- kyc_requests
  SELECT kr.id, kr.client_id, NULL::uuid, kr.created_at,
         'kyc','info',
         'KYC — statut ' || COALESCE(kr.status,''),
         'Système','system',
         'kyc_requests', kr.id::text, NULL::uuid, 'admin', 70, to_jsonb(kr.*)
    FROM kyc_requests kr
  UNION ALL
  -- consent_records
  SELECT cr.id, cr.subject_user_id, cr.account_id, cr.created_at,
         'consent','info',
         ('Consentement ' || COALESCE(cr.consent_type::text,'')) || ' — ' || COALESCE(cr.status::text,''),
         COALESCE(cr.recorded_by_email,'Système'),
         COALESCE(cr.recorded_by_role,'system'),
         'consent_records', cr.id::text, NULL::uuid, 'admin', 70, to_jsonb(cr.*)
    FROM consent_records cr
  UNION ALL
  -- privacy_requests
  SELECT pr.id, pr.client_id, pr.account_id, pr.created_at,
         'privacy','info',
         ('Demande vie privée — ' || COALESCE(pr.status,'')) || ' — ' || left(COALESCE(pr.description,''),140),
         'Système','admin',
         'privacy_requests', pr.id::text, NULL::uuid, 'admin', 70, to_jsonb(pr.*)
    FROM privacy_requests pr
  UNION ALL
  -- document_audit_log
  SELECT dal.id, dal.target_user_id, NULL::uuid, dal.created_at,
         'document','info',
         'Document — ' || COALESCE(dal.action,''),
         COALESCE(dal.actor_role,'system'),
         COALESCE(dal.actor_role,'system'),
         'document_audit_log', dal.id::text, NULL::uuid, 'admin', 60, to_jsonb(dal.*)
    FROM document_audit_log dal
  UNION ALL
  -- nps_surveys
  SELECT ns.id, ns.client_id, ns.account_id, ns.responded_at,
         'nps',
         CASE ns.category WHEN 'promoter' THEN 'success' WHEN 'detractor' THEN 'error' ELSE 'info' END,
         (('NPS ' || COALESCE(ns.category,'—')) || ' — score ' || COALESCE(ns.score::text,'?')) ||
           CASE WHEN ns.comment IS NOT NULL THEN ' — ' || left(ns.comment,100) ELSE '' END,
         'Client','client',
         'nps_surveys', ns.id::text, NULL::uuid, 'staff', 65, to_jsonb(ns.*)
    FROM nps_surveys ns WHERE ns.responded_at IS NOT NULL
  UNION ALL
  -- account_ownership_transfers
  SELECT aot.id, NULL::uuid, aot.account_id, aot.updated_at,
         'account_transfer',
         CASE aot.status::text WHEN 'completed' THEN 'success' WHEN 'cancelled' THEN 'warning' WHEN 'rejected' THEN 'error' WHEN 'expired' THEN 'error' ELSE 'info' END,
         'Transfert responsabilité: ' || aot.status::text,
         'Système','admin',
         'account_ownership_transfers', aot.id::text, aot.correlation_id, 'staff', 75, to_jsonb(aot.*)
    FROM account_ownership_transfers aot
  -- ============================================================
  -- B2.1 NEW: order_status_history (event_type='order', priority=80)
  -- ============================================================
  UNION ALL
  SELECT osh.id, o.user_id, NULL::uuid, osh.created_at,
         'order'::text,
         CASE lower(COALESCE(osh.new_status,'')) 
           WHEN 'cancelled' THEN 'warning'
           WHEN 'failed' THEN 'error'
           WHEN 'refunded' THEN 'warning'
           WHEN 'delivered' THEN 'success'
           WHEN 'paid' THEN 'success'
           ELSE 'info' END,
         ('Commande #' || COALESCE(o.order_number,'?')) || ' — ' ||
           COALESCE(NULLIF(osh.old_status,''),'∅') || ' → ' || COALESCE(osh.new_status,'?') ||
           CASE WHEN osh.change_reason IS NOT NULL THEN ' — ' || left(osh.change_reason,120) ELSE '' END,
         COALESCE(osh.actor_name,'Système'),
         COALESCE(osh.actor_role,'system'),
         'order_status_history'::text, osh.id::text,
         osh.correlation_id, 'client'::text, 80,
         to_jsonb(osh.*)
    FROM order_status_history osh
    JOIN orders o ON o.id = osh.order_id
  -- ============================================================
  -- B2.1 NEW: service_address_history (event_type='address', priority=45)
  -- Join account_id → accounts.client_id to derive owning client
  -- ============================================================
  UNION ALL
  SELECT sah.id, a.client_id, sah.account_id, sah.created_at,
         'address'::text,
         CASE lower(COALESCE(sah.event_type,''))
           WHEN 'delete' THEN 'warning'
           WHEN 'soft_delete' THEN 'warning'
           WHEN 'restore' THEN 'success'
           ELSE 'info' END,
         'Adresse — ' || COALESCE(sah.event_type,'change'),
         'Système'::text, COALESCE(sah.actor_role,'system'),
         'service_address_history'::text, sah.id::text,
         NULL::uuid, 'staff'::text, 45,
         to_jsonb(sah.*)
    FROM service_address_history sah
    LEFT JOIN accounts a ON a.id = sah.account_id
  -- ============================================================
  -- B2.1 NEW: client_profile_changes (event_type='profile', priority=40)
  -- Lower priority than M50 activity_logs (50), so dedup drops legacy
  -- rows when correlation_id matches. Legacy rows w/o correlation_id
  -- pass through.
  -- ============================================================
  UNION ALL
  SELECT cpc.id, cpc.client_id, NULL::uuid, cpc.created_at,
         'profile'::text, 'info'::text,
         'Profil — ' || COALESCE(cpc.field_name,'?') || ': ' ||
           COALESCE(NULLIF(cpc.old_value,''),'∅') || ' → ' || COALESCE(cpc.new_value,'?'),
         'Système'::text,
         COALESCE(cpc.changed_by_role,'system'),
         'client_profile_changes'::text, cpc.id::text,
         NULL::uuid, 'staff'::text, 40,
         to_jsonb(cpc.*)
    FROM client_profile_changes cpc
), dedup AS (
  SELECT r.*,
    CASE WHEN r.correlation_id IS NULL THEN 1::bigint
         ELSE row_number() OVER (PARTITION BY r.correlation_id ORDER BY r.dedup_priority DESC, r.occurred_at DESC)
    END AS rn
  FROM raw r
)
SELECT event_id, client_id, account_id, occurred_at, event_type, severity, summary,
       actor_name, actor_role, source_table, source_id, details, correlation_id, visibility
FROM dedup WHERE rn = 1;

REVOKE ALL ON public.v_customer_timeline FROM anon;
GRANT SELECT ON public.v_customer_timeline TO authenticated, service_role;
