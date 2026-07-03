
CREATE TABLE IF NOT EXISTS public.field_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id uuid REFERENCES public.field_payment_intents(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES public.field_quotes(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  actor text,
  actor_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_field_order_events_intent ON public.field_order_events (intent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_field_order_events_type ON public.field_order_events (event_type, created_at DESC);

GRANT SELECT ON public.field_order_events TO authenticated;
GRANT ALL ON public.field_order_events TO service_role;

ALTER TABLE public.field_order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read order events" ON public.field_order_events;
CREATE POLICY "Staff can read order events"
ON public.field_order_events FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'field_sales')
  OR public.has_role(auth.uid(), 'supervisor')
  OR public.has_role(auth.uid(), 'support')
);

CREATE OR REPLACE FUNCTION public.log_field_order_event(
  p_intent_id uuid,
  p_event_type text,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_quote_id uuid;
  v_event_id uuid;
BEGIN
  IF p_event_type IS NULL OR p_event_type NOT IN (
    'link_created','email_sent','link_opened','client_edited',
    'signature_saved','payment_attempted','payment_failed',
    'payment_succeeded','order_materialized','link_expired','link_cancelled'
  ) THEN
    RAISE EXCEPTION 'invalid event_type: %', p_event_type;
  END IF;

  SELECT quote_id INTO v_quote_id
  FROM public.field_payment_intents
  WHERE id = p_intent_id;

  INSERT INTO public.field_order_events (intent_id, quote_id, event_type, actor, payload)
  VALUES (p_intent_id, v_quote_id, p_event_type, 'client', COALESCE(p_payload, '{}'::jsonb))
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_field_order_event(uuid, text, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.field_intent_lock_for_payment(p_intent_id uuid)
RETURNS TABLE(locked boolean, current_status text, amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated int;
  v_status text;
  v_amount numeric;
BEGIN
  UPDATE public.field_payment_intents
     SET status = 'processing', updated_at = now()
   WHERE id = p_intent_id
     AND status = 'pending'
     AND (expires_at IS NULL OR expires_at > now());

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  SELECT status, amount INTO v_status, v_amount
  FROM public.field_payment_intents
  WHERE id = p_intent_id;

  RETURN QUERY SELECT (v_updated = 1), v_status, v_amount;
END;
$$;

GRANT EXECUTE ON FUNCTION public.field_intent_lock_for_payment(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.field_intent_release_lock(p_intent_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.field_payment_intents
     SET status = 'pending', updated_at = now()
   WHERE id = p_intent_id
     AND status = 'processing';
END;
$$;

GRANT EXECUTE ON FUNCTION public.field_intent_release_lock(uuid) TO service_role;
