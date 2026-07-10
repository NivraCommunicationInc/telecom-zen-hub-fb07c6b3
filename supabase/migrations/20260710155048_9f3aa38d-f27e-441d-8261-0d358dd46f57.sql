
-- =========================================================================
-- MODULE 35 — PHASE A : Foundations for canonical ticket flow
-- =========================================================================

-- 1) State transitions audit table --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ticket_state_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  actor_user_id uuid,
  actor_role text,
  source text NOT NULL DEFAULT 'core',
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ticket_state_transitions TO authenticated;
GRANT ALL ON public.ticket_state_transitions TO service_role;

ALTER TABLE public.ticket_state_transitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view state transitions" ON public.ticket_state_transitions;
CREATE POLICY "Staff can view state transitions"
  ON public.ticket_state_transitions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'employee'::app_role));

CREATE INDEX IF NOT EXISTS idx_ticket_state_transitions_ticket ON public.ticket_state_transitions(ticket_id, created_at DESC);

-- 2) Ticket number sequence & generator --------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.support_ticket_number_seq START 100000;

CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next bigint;
BEGIN
  v_next := nextval('public.support_ticket_number_seq');
  RETURN 'TKT-' || to_char(now(),'YYYY') || '-' || lpad(v_next::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.support_tickets_set_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR btrim(NEW.ticket_number) = '' THEN
    NEW.ticket_number := public.generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_tickets_set_number ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_set_number
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.support_tickets_set_number();

-- 3) State machine guard -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.support_tickets_guard_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_ok text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_ok := current_setting('app.ticket_transition_ok', true);
    IF v_ok IS NULL OR v_ok <> '1' THEN
      RAISE EXCEPTION 'INVARIANT-TICKET-STATE: direct UPDATE of support_tickets.status is forbidden. Use public.rpc_ticket_transition().' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_tickets_guard_status ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_guard_status
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.support_tickets_guard_status();

-- 4) Single-door write guard ---------------------------------------------------------
-- Deny INSERT/UPDATE/DELETE from `authenticated`; only service_role & SECURITY DEFINER
-- RPCs (which run as function owner, bypassing role checks) may write.
CREATE OR REPLACE FUNCTION public.support_tickets_guard_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_ok text;
BEGIN
  v_ok := current_setting('app.support_write_ok', true);
  IF v_ok = '1' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  -- Allow service_role & superuser bypass (edge functions & migrations)
  IF current_setting('role', true) IN ('service_role') OR session_user IN ('postgres','supabase_admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'INVARIANT-TICKET-SINGLE-DOOR: direct % on % is forbidden. Route via support-account-actions.', TG_OP, TG_TABLE_NAME USING ERRCODE = 'check_violation';
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['support_tickets','ticket_replies','ticket_participants','ticket_attachments'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_guard_write ON public.%s;', t, t);
    EXECUTE format($f$
      CREATE TRIGGER trg_%s_guard_write
        BEFORE INSERT OR UPDATE OR DELETE ON public.%s
        FOR EACH ROW EXECUTE FUNCTION public.support_tickets_guard_write();
    $f$, t, t);
  END LOOP;
END $$;

-- 5) Consolidate RLS on the 4 tables -------------------------------------------------
-- Drop legacy INSERT/UPDATE/DELETE policies to make it explicit that writes go through the guard.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN ('support_tickets','ticket_replies','ticket_participants','ticket_attachments')
      AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Recreate a clean SELECT baseline + explicit deny-writes-through-RLS (belt & braces).
DROP POLICY IF EXISTS "tickets_select_owner_or_participant" ON public.support_tickets;
CREATE POLICY "tickets_select_owner_or_participant"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR owner_user_id = auth.uid()
    OR assigned_to_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.ticket_participants tp WHERE tp.ticket_id = support_tickets.id AND tp.user_id = auth.uid())
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'employee'::app_role)
  );

DROP POLICY IF EXISTS "replies_select_visible" ON public.ticket_replies;
CREATE POLICY "replies_select_visible"
  ON public.ticket_replies FOR SELECT TO authenticated
  USING (
    (NOT is_internal_note AND EXISTS (
       SELECT 1 FROM public.support_tickets st WHERE st.id = ticket_replies.ticket_id
       AND (st.user_id = auth.uid() OR st.owner_user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.ticket_participants tp WHERE tp.ticket_id = st.id AND tp.user_id = auth.uid()))
    ))
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'employee'::app_role)
  );

DROP POLICY IF EXISTS "participants_select_self_or_staff" ON public.ticket_participants;
CREATE POLICY "participants_select_self_or_staff"
  ON public.ticket_participants FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'employee'::app_role));

DROP POLICY IF EXISTS "attachments_select_owner_or_staff" ON public.ticket_attachments;
CREATE POLICY "attachments_select_owner_or_staff"
  ON public.ticket_attachments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.support_tickets st WHERE st.id = ticket_attachments.ticket_id
            AND (st.user_id = auth.uid() OR st.owner_user_id = auth.uid()
                 OR EXISTS (SELECT 1 FROM public.ticket_participants tp WHERE tp.ticket_id = st.id AND tp.user_id = auth.uid())))
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'employee'::app_role)
  );

-- Revoke direct write privileges from authenticated & anon
REVOKE INSERT, UPDATE, DELETE ON public.support_tickets FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.ticket_replies FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.ticket_participants FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.ticket_attachments FROM authenticated, anon;
GRANT SELECT ON public.support_tickets TO authenticated;
GRANT SELECT ON public.ticket_replies TO authenticated;
GRANT SELECT ON public.ticket_participants TO authenticated;
GRANT SELECT ON public.ticket_attachments TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
GRANT ALL ON public.ticket_replies TO service_role;
GRANT ALL ON public.ticket_participants TO service_role;
GRANT ALL ON public.ticket_attachments TO service_role;

-- 6) Canonical status set & transition matrix ---------------------------------------
CREATE OR REPLACE FUNCTION public.ticket_status_allowed(_from text, _to text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _from = _to THEN true
    WHEN _from IS NULL AND _to IN ('open','pending') THEN true
    WHEN _from = 'open'             AND _to IN ('pending','in_progress','waiting_customer','resolved','cancelled') THEN true
    WHEN _from = 'pending'          AND _to IN ('open','in_progress','waiting_customer','resolved','cancelled') THEN true
    WHEN _from = 'in_progress'      AND _to IN ('pending','waiting_customer','resolved','cancelled') THEN true
    WHEN _from = 'waiting_customer' AND _to IN ('in_progress','pending','resolved','cancelled') THEN true
    WHEN _from = 'resolved'         AND _to IN ('open','closed') THEN true
    WHEN _from = 'closed'           AND _to IN ('open') THEN true
    WHEN _from = 'cancelled'        AND _to IN ('open') THEN true
    -- legacy statuses tolerated for read compat; may transition back to open
    WHEN _from IN ('on_hold','ai_replied','escalated','human_replied') AND _to IN ('open','in_progress','pending','waiting_customer','resolved','closed','cancelled') THEN true
    ELSE false
  END;
$$;

-- Also relax CHECK constraint to include waiting_customer
ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_chk;
ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_status_chk
  CHECK (status = ANY (ARRAY['open','pending','in_progress','waiting_customer','on_hold','ai_replied','escalated','human_replied','resolved','closed','cancelled']));

-- 7) rpc_ticket_transition ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_ticket_transition(
  p_ticket_id uuid,
  p_to_status text,
  p_actor_user_id uuid,
  p_actor_role text,
  p_reason text,
  p_source text DEFAULT 'core',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS public.support_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from text;
  v_row public.support_tickets;
BEGIN
  SELECT status INTO v_from FROM public.support_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket_not_found'; END IF;

  IF NOT public.ticket_status_allowed(v_from, p_to_status) THEN
    RAISE EXCEPTION 'INVARIANT-TICKET-TRANSITION: % -> % not allowed', v_from, p_to_status USING ERRCODE='check_violation';
  END IF;

  PERFORM set_config('app.ticket_transition_ok','1', true);
  PERFORM set_config('app.support_write_ok','1', true);

  UPDATE public.support_tickets
     SET status = p_to_status,
         resolved_at = CASE WHEN p_to_status = 'resolved' THEN now()
                            WHEN p_to_status IN ('open','in_progress','pending','waiting_customer') THEN NULL
                            ELSE resolved_at END,
         updated_at = now()
   WHERE id = p_ticket_id
  RETURNING * INTO v_row;

  INSERT INTO public.ticket_state_transitions(ticket_id, from_status, to_status, actor_user_id, actor_role, source, reason, metadata)
  VALUES (p_ticket_id, v_from, p_to_status, p_actor_user_id, p_actor_role, p_source, p_reason, COALESCE(p_metadata,'{}'::jsonb));

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_ticket_transition(uuid,text,uuid,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_ticket_transition(uuid,text,uuid,text,text,text,jsonb) TO service_role;

-- 8) rpc_ticket_create --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_ticket_create(
  p_owner_user_id uuid,
  p_account_id uuid,
  p_subject text,
  p_description text,
  p_category text,
  p_priority text,
  p_source text,
  p_created_by_user_id uuid,
  p_created_by_role text,
  p_client_email text,
  p_client_name text,
  p_related_order_id uuid,
  p_idempotency_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS public.support_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.support_tickets;
  v_existing uuid;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.support_tickets
     WHERE internal_notes IS NOT NULL
       AND internal_notes = 'idem:'||p_idempotency_key
     LIMIT 1;
    IF v_existing IS NOT NULL THEN
      SELECT * INTO v_row FROM public.support_tickets WHERE id = v_existing;
      RETURN v_row;
    END IF;
  END IF;

  PERFORM set_config('app.support_write_ok','1', true);
  PERFORM set_config('app.ticket_transition_ok','1', true);

  INSERT INTO public.support_tickets(
    user_id, owner_user_id, account_id,
    subject, description, body,
    category, priority, status, source,
    created_by_user_id, created_by_role,
    client_email, client_name,
    related_order_id,
    internal_notes
  ) VALUES (
    p_owner_user_id, p_owner_user_id, p_account_id,
    p_subject, p_description, p_description,
    COALESCE(p_category,'general'), COALESCE(p_priority,'normal'), 'open', COALESCE(p_source,'core'),
    p_created_by_user_id, p_created_by_role,
    p_client_email, p_client_name,
    p_related_order_id,
    CASE WHEN p_idempotency_key IS NOT NULL THEN 'idem:'||p_idempotency_key ELSE NULL END
  ) RETURNING * INTO v_row;

  INSERT INTO public.ticket_state_transitions(ticket_id, from_status, to_status, actor_user_id, actor_role, source, reason, metadata)
  VALUES (v_row.id, NULL, 'open', p_created_by_user_id, p_created_by_role, COALESCE(p_source,'core'), 'ticket_created', COALESCE(p_metadata,'{}'::jsonb));

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_ticket_create(uuid,uuid,text,text,text,text,text,uuid,text,text,text,uuid,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_ticket_create(uuid,uuid,text,text,text,text,text,uuid,text,text,text,uuid,text,jsonb) TO service_role;

-- 9) rpc_ticket_reply ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_ticket_reply(
  p_ticket_id uuid,
  p_author_user_id uuid,
  p_author_role text,
  p_content text,
  p_is_internal_note boolean,
  p_sender_name text,
  p_sender_email text,
  p_email_message_id text,
  p_subject text,
  p_attachments jsonb,
  p_idempotency_key text
)
RETURNS public.ticket_replies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ticket_replies;
  v_existing uuid;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.ticket_replies
     WHERE email_message_id = 'idem:'||p_idempotency_key LIMIT 1;
    IF v_existing IS NOT NULL THEN
      SELECT * INTO v_row FROM public.ticket_replies WHERE id = v_existing; RETURN v_row;
    END IF;
  END IF;

  PERFORM set_config('app.support_write_ok','1', true);
  PERFORM set_config('app.ticket_transition_ok','1', true);

  INSERT INTO public.ticket_replies(
    ticket_id, user_id, content, is_admin, is_internal_note,
    sender_name, sender_role, sender_type, sender_email,
    email_message_id, subject, attachments
  ) VALUES (
    p_ticket_id, p_author_user_id, p_content,
    (p_author_role IN ('admin','employee')),
    COALESCE(p_is_internal_note,false),
    p_sender_name, COALESCE(p_author_role,'client'),
    CASE WHEN p_author_role IN ('admin','employee') THEN 'staff'
         WHEN p_author_role IN ('bot','ai','nova','chatbot') THEN 'bot'
         ELSE 'client' END,
    p_sender_email,
    COALESCE(p_email_message_id, CASE WHEN p_idempotency_key IS NOT NULL THEN 'idem:'||p_idempotency_key ELSE NULL END),
    p_subject,
    COALESCE(p_attachments,'[]'::jsonb)
  ) RETURNING * INTO v_row;

  UPDATE public.support_tickets SET updated_at = now() WHERE id = p_ticket_id;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_ticket_reply(uuid,uuid,text,text,boolean,text,text,text,text,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_ticket_reply(uuid,uuid,text,text,boolean,text,text,text,text,jsonb,text) TO service_role;

-- 10) rpc_ticket_add_participant ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_ticket_add_participant(
  p_ticket_id uuid,
  p_user_id uuid,
  p_user_email text,
  p_user_name text,
  p_role text,
  p_can_reply boolean,
  p_can_reassign boolean,
  p_added_by uuid
)
RETURNS public.ticket_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.ticket_participants;
BEGIN
  PERFORM set_config('app.support_write_ok','1', true);
  INSERT INTO public.ticket_participants(ticket_id,user_id,user_email,user_name,role,can_reply,can_reassign,added_by)
  VALUES (p_ticket_id,p_user_id,p_user_email,p_user_name,COALESCE(p_role,'participant'),COALESCE(p_can_reply,true),COALESCE(p_can_reassign,false),p_added_by)
  ON CONFLICT (ticket_id,user_id) DO UPDATE SET role=EXCLUDED.role, can_reply=EXCLUDED.can_reply, can_reassign=EXCLUDED.can_reassign
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_ticket_add_participant(uuid,uuid,text,text,text,boolean,boolean,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_ticket_add_participant(uuid,uuid,text,text,text,boolean,boolean,uuid) TO service_role;

-- 11) rpc_ticket_add_attachment -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_ticket_add_attachment(
  p_ticket_id uuid,
  p_reply_id uuid,
  p_uploader_id uuid,
  p_file_name text,
  p_file_path text,
  p_file_size int,
  p_file_type text,
  p_storage_bucket text
)
RETURNS public.ticket_attachments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.ticket_attachments;
BEGIN
  PERFORM set_config('app.support_write_ok','1', true);
  INSERT INTO public.ticket_attachments(ticket_id,reply_id,uploader_id,file_name,file_path,file_size,file_type,storage_bucket)
  VALUES (p_ticket_id,p_reply_id,p_uploader_id,p_file_name,p_file_path,p_file_size,p_file_type,COALESCE(p_storage_bucket,'ticket-attachments'))
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_ticket_add_attachment(uuid,uuid,uuid,text,text,int,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_ticket_add_attachment(uuid,uuid,uuid,text,text,int,text,text) TO service_role;

-- 12) Email notification idempotency ------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='email_queue' AND column_name='dedupe_key') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='uq_email_queue_dedupe_key_ticket') THEN
      CREATE UNIQUE INDEX uq_email_queue_dedupe_key_ticket
        ON public.email_queue(dedupe_key)
        WHERE dedupe_key LIKE 'ticket_%';
    END IF;
  END IF;
END $$;
