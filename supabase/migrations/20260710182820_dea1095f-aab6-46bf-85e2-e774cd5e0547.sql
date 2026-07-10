
CREATE OR REPLACE FUNCTION public.rpc_create_supervisor_escalation(
  p_account_id uuid,
  p_client_user_id uuid,
  p_related_support_ticket_id uuid,
  p_idempotency_key text,
  p_escalation_type text,
  p_subject text,
  p_description text,
  p_created_by_id uuid,
  p_created_by_name text,
  p_created_by_role text,
  p_created_by_email text
)
RETURNS TABLE (id uuid, ticket_number text, idempotent boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_existing_num text;
  v_new_id uuid;
  v_new_num text;
BEGIN
  -- Idempotency check first
  SELECT it.id, it.ticket_number
    INTO v_existing_id, v_existing_num
  FROM public.internal_tickets it
  WHERE it.idempotency_key = p_idempotency_key
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    id := v_existing_id;
    ticket_number := v_existing_num;
    idempotent := true;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Bypass INVARIANT-ESCALATION-SINGLE-DOOR trigger (transaction-scoped)
  PERFORM set_config('app.escalation_write_ok', 'on', true);

  INSERT INTO public.internal_tickets (
    account_id,
    client_user_id,
    related_support_ticket_id,
    idempotency_key,
    escalation_type,
    subject,
    description,
    category,
    assigned_to_department,
    priority,
    status,
    created_by_id,
    created_by_name,
    created_by_role,
    created_by_email
  ) VALUES (
    p_account_id,
    p_client_user_id,
    p_related_support_ticket_id,
    p_idempotency_key,
    p_escalation_type,
    p_subject,
    p_description,
    'escalation',
    'supervisor',
    'urgent',
    'open',
    p_created_by_id,
    p_created_by_name,
    p_created_by_role,
    p_created_by_email
  )
  RETURNING internal_tickets.id, internal_tickets.ticket_number
    INTO v_new_id, v_new_num;

  id := v_new_id;
  ticket_number := v_new_num;
  idempotent := false;
  RETURN NEXT;
EXCEPTION
  WHEN unique_violation THEN
    SELECT it.id, it.ticket_number
      INTO v_existing_id, v_existing_num
    FROM public.internal_tickets it
    WHERE it.idempotency_key = p_idempotency_key
    LIMIT 1;
    id := v_existing_id;
    ticket_number := v_existing_num;
    idempotent := true;
    RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_create_supervisor_escalation(uuid,uuid,uuid,text,text,text,text,uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_create_supervisor_escalation(uuid,uuid,uuid,text,text,text,text,uuid,text,text,text) TO service_role;
