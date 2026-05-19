
-- ============ 1. Extend crm_contacts ============
ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS desired_install_date date,
  ADD COLUMN IF NOT EXISTS service_address text,
  ADD COLUMN IF NOT EXISTS service_city text,
  ADD COLUMN IF NOT EXISTS service_postal_code text,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by_name text,
  ADD COLUMN IF NOT EXISTS next_callback_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_order_id uuid;

CREATE INDEX IF NOT EXISTS idx_crm_contacts_locked_until ON public.crm_contacts(locked_until) WHERE locked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_contacts_next_callback ON public.crm_contacts(next_callback_at) WHERE next_callback_at IS NOT NULL;

-- ============ 2. crm_call_logs ============
CREATE TABLE IF NOT EXISTS public.crm_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL,
  agent_name text,
  agent_portal text NOT NULL DEFAULT 'field',  -- 'field' | 'employee' | 'core'
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  outcome text NOT NULL CHECK (outcome IN ('sold','voicemail','callback','not_interested','wrong_number','no_answer','in_progress')),
  notes text,
  callback_at timestamptz,
  order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_call_logs_contact ON public.crm_call_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_call_logs_agent ON public.crm_call_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_crm_call_logs_started ON public.crm_call_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_call_logs_outcome ON public.crm_call_logs(outcome);

ALTER TABLE public.crm_call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view crm_call_logs" ON public.crm_call_logs;
CREATE POLICY "Staff can view crm_call_logs" ON public.crm_call_logs FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'field_sales'::app_role)
  OR has_role(auth.uid(), 'sales'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
);

DROP POLICY IF EXISTS "Agents can insert their own crm_call_logs" ON public.crm_call_logs;
CREATE POLICY "Agents can insert their own crm_call_logs" ON public.crm_call_logs FOR INSERT TO authenticated
WITH CHECK (
  agent_id = auth.uid() AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'employee'::app_role)
    OR has_role(auth.uid(), 'field_sales'::app_role)
    OR has_role(auth.uid(), 'sales'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
  )
);

DROP POLICY IF EXISTS "Admins manage crm_call_logs" ON public.crm_call_logs;
CREATE POLICY "Admins manage crm_call_logs" ON public.crm_call_logs FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============ 3. RPCs ============

-- Lock contact for 30 minutes
CREATE OR REPLACE FUNCTION public.crm_lock_contact(p_contact_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_contact record;
  v_agent_name text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  IF NOT (
    has_role(v_uid, 'admin'::app_role)
    OR has_role(v_uid, 'employee'::app_role)
    OR has_role(v_uid, 'field_sales'::app_role)
    OR has_role(v_uid, 'sales'::app_role)
    OR has_role(v_uid, 'supervisor'::app_role)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_contact FROM crm_contacts WHERE id = p_contact_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_contact.locked_until IS NOT NULL
     AND v_contact.locked_until > v_now
     AND v_contact.locked_by IS NOT NULL
     AND v_contact.locked_by <> v_uid THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'locked',
      'locked_by_name', v_contact.locked_by_name,
      'locked_until', v_contact.locked_until
    );
  END IF;

  SELECT COALESCE(full_name, email) INTO v_agent_name FROM profiles WHERE user_id = v_uid LIMIT 1;

  UPDATE crm_contacts
  SET is_locked = true,
      locked_by = v_uid,
      locked_by_name = COALESCE(v_agent_name, 'Agent'),
      locked_at = v_now,
      locked_until = v_now + interval '30 minutes',
      call_status = 'in_progress'
  WHERE id = p_contact_id;

  RETURN jsonb_build_object('ok', true, 'locked_until', v_now + interval '30 minutes');
END;
$$;

GRANT EXECUTE ON FUNCTION public.crm_lock_contact(uuid) TO authenticated;

-- Unlock contact
CREATE OR REPLACE FUNCTION public.crm_unlock_contact(p_contact_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  UPDATE crm_contacts
  SET is_locked = false,
      locked_by = NULL,
      locked_by_name = NULL,
      locked_at = NULL,
      locked_until = NULL,
      call_status = CASE WHEN call_status = 'in_progress' THEN 'not_called' ELSE call_status END
  WHERE id = p_contact_id
    AND (locked_by = v_uid OR has_role(v_uid, 'admin'::app_role));

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.crm_unlock_contact(uuid) TO authenticated;

-- Log a call result
CREATE OR REPLACE FUNCTION public.crm_log_call(
  p_contact_id uuid,
  p_outcome text,
  p_notes text DEFAULT NULL,
  p_callback_at timestamptz DEFAULT NULL,
  p_portal text DEFAULT 'field',
  p_order_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_contact record;
  v_agent_name text;
  v_new_status text;
  v_attempts int;
  v_log_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  IF NOT (
    has_role(v_uid, 'admin'::app_role)
    OR has_role(v_uid, 'employee'::app_role)
    OR has_role(v_uid, 'field_sales'::app_role)
    OR has_role(v_uid, 'sales'::app_role)
    OR has_role(v_uid, 'supervisor'::app_role)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF p_outcome NOT IN ('sold','voicemail','callback','not_interested','wrong_number','no_answer') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_outcome');
  END IF;

  SELECT * INTO v_contact FROM crm_contacts WHERE id = p_contact_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT COALESCE(full_name, email) INTO v_agent_name FROM profiles WHERE user_id = v_uid LIMIT 1;
  v_attempts := COALESCE(v_contact.call_attempts, 0) + 1;

  v_new_status := CASE p_outcome
    WHEN 'sold' THEN 'sold'
    WHEN 'voicemail' THEN 'message_left'
    WHEN 'callback' THEN 'callback'
    WHEN 'not_interested' THEN 'not_interested'
    WHEN 'wrong_number' THEN 'do_not_call'
    WHEN 'no_answer' THEN 'no_answer'
    ELSE 'called'
  END;

  -- auto-archive after 3 attempts unless sold/callback
  IF v_attempts >= 3 AND p_outcome IN ('no_answer','voicemail') THEN
    v_new_status := 'do_not_call';
  END IF;

  INSERT INTO crm_call_logs(contact_id, agent_id, agent_name, agent_portal, started_at, ended_at, outcome, notes, callback_at, order_id)
  VALUES (p_contact_id, v_uid, v_agent_name, p_portal, v_now, v_now, p_outcome, p_notes, p_callback_at, p_order_id)
  RETURNING id INTO v_log_id;

  UPDATE crm_contacts
  SET call_status = v_new_status,
      call_attempts = v_attempts,
      last_called_at = v_now,
      last_called_by = v_uid,
      call_notes = COALESCE(p_notes, call_notes),
      next_callback_at = CASE WHEN p_outcome = 'callback' THEN p_callback_at
                              WHEN p_outcome = 'voicemail' THEN v_now + interval '24 hours'
                              WHEN p_outcome = 'no_answer' THEN v_now + interval '2 hours'
                              ELSE next_callback_at END,
      callback_scheduled_at = CASE WHEN p_outcome = 'callback' THEN p_callback_at ELSE callback_scheduled_at END,
      converted_order_id = COALESCE(p_order_id, converted_order_id),
      is_locked = false,
      locked_by = NULL,
      locked_by_name = NULL,
      locked_at = NULL,
      locked_until = NULL
  WHERE id = p_contact_id;

  RETURN jsonb_build_object('ok', true, 'log_id', v_log_id, 'new_status', v_new_status, 'attempts', v_attempts);
END;
$$;

GRANT EXECUTE ON FUNCTION public.crm_log_call(uuid, text, text, timestamptz, text, uuid) TO authenticated;

-- Auto-unlock expired locks
CREATE OR REPLACE FUNCTION public.crm_auto_unlock_expired()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  UPDATE crm_contacts
  SET is_locked = false,
      locked_by = NULL,
      locked_by_name = NULL,
      locked_at = NULL,
      locked_until = NULL,
      call_status = CASE WHEN call_status = 'in_progress' THEN 'not_called' ELSE call_status END
  WHERE locked_until IS NOT NULL AND locked_until < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crm_auto_unlock_expired() TO authenticated;

-- ============ 4. Leaderboard view ============
CREATE OR REPLACE VIEW public.crm_leaderboard_v
WITH (security_invoker = on)
AS
SELECT
  l.agent_id,
  l.agent_name,
  COUNT(*) FILTER (WHERE l.started_at >= date_trunc('day', now())) AS calls_today,
  COUNT(*) FILTER (WHERE l.started_at >= date_trunc('week', now())) AS calls_week,
  COUNT(*) FILTER (WHERE l.started_at >= date_trunc('month', now())) AS calls_month,
  COUNT(*) FILTER (WHERE l.outcome = 'sold' AND l.started_at >= date_trunc('day', now())) AS sales_today,
  COUNT(*) FILTER (WHERE l.outcome = 'sold' AND l.started_at >= date_trunc('week', now())) AS sales_week,
  COUNT(*) FILTER (WHERE l.outcome = 'sold' AND l.started_at >= date_trunc('month', now())) AS sales_month,
  CASE WHEN COUNT(*) FILTER (WHERE l.started_at >= date_trunc('day', now())) > 0
    THEN ROUND(100.0 * COUNT(*) FILTER (WHERE l.outcome = 'sold' AND l.started_at >= date_trunc('day', now()))
              / COUNT(*) FILTER (WHERE l.started_at >= date_trunc('day', now())), 1)
    ELSE 0 END AS conversion_rate_today
FROM crm_call_logs l
GROUP BY l.agent_id, l.agent_name;

GRANT SELECT ON public.crm_leaderboard_v TO authenticated;

-- ============ 5. Realtime ============
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_call_logs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ============ 6. Cron: auto-unlock every 5 min ============
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('crm-auto-unlock');
    PERFORM cron.schedule(
      'crm-auto-unlock',
      '*/5 * * * *',
      $cron$ SELECT public.crm_auto_unlock_expired(); $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
