
-- Idempotency cache for escalation actions
CREATE TABLE IF NOT EXISTS public.escalation_action_idempotency (
  idempotency_key text PRIMARY KEY,
  request_hash text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
GRANT ALL ON public.escalation_action_idempotency TO service_role;
ALTER TABLE public.escalation_action_idempotency ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "escalation_idem_service_only" ON public.escalation_action_idempotency;
CREATE POLICY "escalation_idem_service_only"
  ON public.escalation_action_idempotency
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_escalation_action_idem_expires ON public.escalation_action_idempotency(expires_at);

-- State machine transition RPC
CREATE OR REPLACE FUNCTION public.rpc_supervisor_escalation_transition(
  p_ticket_id uuid,
  p_new_status text,
  p_actor_id uuid,
  p_actor_name text,
  p_actor_role text,
  p_reason text,
  p_assignee_id uuid DEFAULT NULL,
  p_assignee_name text DEFAULT NULL
)
RETURNS TABLE(id uuid, old_status text, new_status text, ticket_number text, account_id uuid, client_user_id uuid, created_by_id uuid, created_by_email text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.internal_tickets%ROWTYPE;
  v_allowed boolean;
BEGIN
  SELECT * INTO v_row
    FROM public.internal_tickets it
    WHERE it.id = p_ticket_id AND it.assigned_to_department = 'supervisor'
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_allowed := CASE v_row.status
    WHEN 'open'               THEN p_new_status = 'assigned'
    WHEN 'assigned'           THEN p_new_status IN ('investigating','closed')
    WHEN 'investigating'      THEN p_new_status IN ('waiting_information','resolved','closed')
    WHEN 'waiting_information' THEN p_new_status = 'investigating'
    WHEN 'resolved'           THEN p_new_status = 'closed'
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'invalid_transition:%->%', v_row.status, p_new_status USING ERRCODE = 'P0001';
  END IF;

  IF p_new_status = 'assigned' AND p_assignee_id IS NULL THEN
    RAISE EXCEPTION 'assignee_required_for_assigned' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.escalation_write_ok', 'on', true);

  UPDATE public.internal_tickets SET
    status = p_new_status,
    assigned_to_id   = COALESCE(p_assignee_id, assigned_to_id),
    assigned_to_name = COALESCE(p_assignee_name, assigned_to_name),
    resolved_at      = CASE WHEN p_new_status = 'resolved' THEN now() ELSE resolved_at END,
    resolved_by_id   = CASE WHEN p_new_status = 'resolved' THEN p_actor_id ELSE resolved_by_id END,
    resolved_by_name = CASE WHEN p_new_status = 'resolved' THEN p_actor_name ELSE resolved_by_name END,
    updated_at       = now()
  WHERE internal_tickets.id = p_ticket_id;

  id := p_ticket_id;
  old_status := v_row.status;
  new_status := p_new_status;
  ticket_number := v_row.ticket_number;
  account_id := v_row.account_id;
  client_user_id := v_row.client_user_id;
  created_by_id := v_row.created_by_id;
  created_by_email := v_row.created_by_email;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_supervisor_escalation_transition(uuid,text,uuid,text,text,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_supervisor_escalation_transition(uuid,text,uuid,text,text,text,uuid,text) TO service_role;
