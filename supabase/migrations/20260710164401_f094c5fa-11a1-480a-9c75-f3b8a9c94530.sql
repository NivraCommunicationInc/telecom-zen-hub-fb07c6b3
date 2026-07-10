
-- Module 35 — Vague 3: canonical AI helpers for ticket flow
-- Adds two SECURITY DEFINER RPCs so that support-email-inbound and
-- support-ai-responder no longer perform direct writes on support_tickets.

CREATE OR REPLACE FUNCTION public.rpc_ticket_set_ai_schedule(
  p_ticket_id uuid,
  p_ai_scheduled_at timestamptz
)
RETURNS public.support_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.support_tickets;
BEGIN
  PERFORM set_config('app.support_write_ok','1', true);
  PERFORM set_config('app.ticket_transition_ok','1', true);

  UPDATE public.support_tickets
     SET ai_scheduled_at = p_ai_scheduled_at,
         status = CASE WHEN status IN ('closed','cancelled','resolved') THEN status ELSE 'open' END,
         updated_at = now()
   WHERE id = p_ticket_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'ticket_not_found'; END IF;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_ticket_set_ai_schedule(uuid,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_ticket_set_ai_schedule(uuid,timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_ticket_apply_ai_result(
  p_ticket_id uuid,
  p_outcome text,           -- 'ai_replied' | 'escalated'
  p_ai_response text,
  p_ai_confidence numeric,
  p_category text,
  p_escalated_reason text DEFAULT NULL,
  p_internal_notes text DEFAULT NULL
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
  IF p_outcome NOT IN ('ai_replied','escalated') THEN
    RAISE EXCEPTION 'invalid_outcome:%', p_outcome;
  END IF;

  SELECT status INTO v_from FROM public.support_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket_not_found'; END IF;

  PERFORM set_config('app.support_write_ok','1', true);
  PERFORM set_config('app.ticket_transition_ok','1', true);

  UPDATE public.support_tickets
     SET status = p_outcome,
         ai_response = p_ai_response,
         ai_responded_at = now(),
         ai_confidence = COALESCE(p_ai_confidence, ai_confidence),
         category = COALESCE(p_category, category),
         first_response_at = COALESCE(first_response_at, now()),
         escalated_at = CASE WHEN p_outcome = 'escalated' THEN now() ELSE escalated_at END,
         escalated_reason = CASE WHEN p_outcome = 'escalated' THEN p_escalated_reason ELSE escalated_reason END,
         internal_notes = CASE WHEN p_internal_notes IS NOT NULL
                               THEN COALESCE(internal_notes || E'\n', '') || p_internal_notes
                               ELSE internal_notes END,
         updated_at = now()
   WHERE id = p_ticket_id
  RETURNING * INTO v_row;

  INSERT INTO public.ticket_state_transitions(ticket_id, from_status, to_status, actor_user_id, actor_role, source, reason, metadata)
  VALUES (p_ticket_id, v_from, p_outcome, NULL, 'bot', 'support-ai-responder',
          COALESCE(p_escalated_reason, 'ai_auto_reply'),
          jsonb_build_object('confidence', p_ai_confidence, 'category', p_category));

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_ticket_apply_ai_result(uuid,text,text,numeric,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_ticket_apply_ai_result(uuid,text,text,numeric,text,text,text) TO service_role;
