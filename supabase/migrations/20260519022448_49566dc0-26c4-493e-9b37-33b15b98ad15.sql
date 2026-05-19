-- CRM Quick Actions: quick note, status change, schedule callback (assigns agent + flags reminder), reminder column
ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS callback_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS callback_agent_id uuid;

CREATE INDEX IF NOT EXISTS idx_crm_contacts_callback_reminder
  ON public.crm_contacts (next_callback_at)
  WHERE next_callback_at IS NOT NULL AND callback_reminder_sent_at IS NULL;

-- Quick note RPC: append a note line (timestamped + author) without ending the call
CREATE OR REPLACE FUNCTION public.crm_set_note(p_contact_id uuid, p_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_prefix text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  IF p_note IS NULL OR length(btrim(p_note)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_note');
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE user_id = v_uid;
  v_prefix := concat('[', to_char(now() AT TIME ZONE 'America/Toronto', 'YYYY-MM-DD HH24:MI'), ' — ', coalesce(v_name, 'Agent'), '] ');

  UPDATE public.crm_contacts
     SET call_notes = concat_ws(E'\n', call_notes, v_prefix || btrim(p_note))
   WHERE id = p_contact_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_set_note(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.crm_set_note(uuid, text) TO authenticated;

-- Quick status RPC: change call_status to whitelisted values
CREATE OR REPLACE FUNCTION public.crm_set_status(p_contact_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  IF p_status NOT IN ('not_called','called','no_answer','message_left','not_interested','do_not_call','sold','callback','in_progress') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  UPDATE public.crm_contacts
     SET call_status = p_status,
         last_called_by = COALESCE(last_called_by, v_uid)
   WHERE id = p_contact_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_set_status(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.crm_set_status(uuid, text) TO authenticated;

-- Schedule callback RPC: sets next_callback_at, assigns agent, logs entry, resets reminder flag
CREATE OR REPLACE FUNCTION public.crm_schedule_callback(p_contact_id uuid, p_callback_at timestamptz, p_notes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  IF p_callback_at IS NULL OR p_callback_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_callback_date');
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE user_id = v_uid;

  INSERT INTO public.crm_call_logs(contact_id, agent_id, agent_name, agent_portal, started_at, ended_at, outcome, notes, callback_at)
  VALUES (p_contact_id, v_uid, v_name, 'web', now(), now(), 'callback', p_notes, p_callback_at);

  UPDATE public.crm_contacts
     SET next_callback_at = p_callback_at,
         callback_scheduled_at = now(),
         call_status = 'callback',
         assigned_to = v_uid,
         callback_agent_id = v_uid,
         callback_reminder_sent_at = NULL
   WHERE id = p_contact_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_schedule_callback(uuid, timestamptz, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.crm_schedule_callback(uuid, timestamptz, text) TO authenticated;