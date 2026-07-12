-- Module 54.2 — Fermeture du dernier writer direct vers email_queue
-- Patch minimal canonique : public.queue_email délègue à rpc_communication_enqueue.
-- Contrat préservé : signature identique, RETURNS uuid, idempotence via p_event_key.

CREATE OR REPLACE FUNCTION public.queue_email(
  p_event_key text,
  p_to_email text,
  p_template_key text,
  p_template_vars jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result jsonb;
  v_queue_row_id uuid;
BEGIN
  -- Délégation stricte au gateway canonique. Aucun INSERT direct.
  v_result := public.rpc_communication_enqueue(
    p_channel         => 'email',
    p_template_key    => p_template_key,
    p_recipient       => p_to_email,
    p_template_vars   => COALESCE(p_template_vars, '{}'::jsonb),
    p_idempotency_key => p_event_key,
    p_category        => 'transactional'
  );

  -- Le gateway renvoie queue_row_id à la fois pour un enqueue neuf et pour un hit d'idempotence.
  v_queue_row_id := NULLIF(v_result->>'queue_row_id', '')::uuid;
  RETURN v_queue_row_id;
END;
$function$;

COMMENT ON FUNCTION public.queue_email(text,text,text,jsonb) IS
'Module 54.2: shim rétro-compat. Délègue exclusivement à rpc_communication_enqueue. Aucun INSERT direct dans email_queue.';