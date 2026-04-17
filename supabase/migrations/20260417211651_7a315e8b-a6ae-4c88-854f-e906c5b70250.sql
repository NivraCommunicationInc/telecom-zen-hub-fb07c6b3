-- Track which automated emails have already been sent per entity (idempotency)
CREATE TABLE IF NOT EXISTS public.auto_email_dispatch_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_kind text NOT NULL,                    -- 'auto_install_shipment' | 'activation_success'
  entity_type text NOT NULL,                   -- 'order' | 'activation_request'
  entity_id uuid NOT NULL,
  dispatched_at timestamptz NOT NULL DEFAULT now(),
  edge_function text NOT NULL,
  payload jsonb,
  UNIQUE (email_kind, entity_id)
);

ALTER TABLE public.auto_email_dispatch_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read auto_email_dispatch_log" ON public.auto_email_dispatch_log;
CREATE POLICY "Admins read auto_email_dispatch_log"
  ON public.auto_email_dispatch_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Generic helper to invoke an edge function via pg_net (best-effort, fire-and-forget)
CREATE OR REPLACE FUNCTION public._invoke_edge_function(
  p_function_name text,
  p_payload jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text;
  v_anon_key text;
BEGIN
  v_url := 'https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/' || p_function_name;
  v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0Z25nbXR4Z2dhc2NieG5zd3ZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMDE2MzYsImV4cCI6MjA4MjY3NzYzNn0.BYQ3k1-N2_bbXCRTRcJ6FWoI6HuDP6BdhSrmCYhJai8';

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := p_payload
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[_invoke_edge_function] Failed to invoke %: %', p_function_name, SQLERRM;
END;
$$;

-- Trigger: when an order is created/updated with auto-installation, send shipment email
CREATE OR REPLACE FUNCTION public.fn_send_auto_installation_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_should_send boolean := false;
BEGIN
  -- Only consider auto / ship_to_home installations
  IF NEW.installation_type IS NULL
     OR NEW.installation_type NOT IN ('auto', 'ship_to_home') THEN
    RETURN NEW;
  END IF;

  -- Only when order is in a state where shipping/auto-install is committed
  IF NEW.status NOT IN ('confirmed', 'processing', 'shipped', 'pending') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_should_send := true;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Send when transitioning into a qualifying status from a non-qualifying one,
    -- or when installation_type was just set to auto.
    IF (OLD.status IS DISTINCT FROM NEW.status
        AND (OLD.status IS NULL OR OLD.status NOT IN ('confirmed','processing','shipped','pending')))
       OR (OLD.installation_type IS DISTINCT FROM NEW.installation_type) THEN
      v_should_send := true;
    END IF;
  END IF;

  IF NOT v_should_send THEN
    RETURN NEW;
  END IF;

  -- Idempotency guard: insert log row, skip if already exists
  BEGIN
    INSERT INTO public.auto_email_dispatch_log
      (email_kind, entity_type, entity_id, edge_function, payload)
    VALUES
      ('auto_install_shipment', 'order', NEW.id, 'send-auto-installation-email',
       jsonb_build_object('order_id', NEW.id));
  EXCEPTION WHEN unique_violation THEN
    RETURN NEW; -- already dispatched
  END;

  PERFORM public._invoke_edge_function(
    'send-auto-installation-email',
    jsonb_build_object('order_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_send_auto_installation_email ON public.orders;
CREATE TRIGGER trg_send_auto_installation_email
  AFTER INSERT OR UPDATE OF status, installation_type ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_send_auto_installation_email();

-- Trigger: when activation_request transitions to completed, send activation success email
CREATE OR REPLACE FUNCTION public.fn_send_activation_success_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only when status transitions to 'completed'
  IF NEW.status IS DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Idempotency
  BEGIN
    INSERT INTO public.auto_email_dispatch_log
      (email_kind, entity_type, entity_id, edge_function, payload)
    VALUES
      ('activation_success', 'activation_request', NEW.id, 'send-activation-success-email',
       jsonb_build_object('activation_request_id', NEW.id));
  EXCEPTION WHEN unique_violation THEN
    RETURN NEW;
  END;

  PERFORM public._invoke_edge_function(
    'send-activation-success-email',
    jsonb_build_object('activation_request_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_send_activation_success_email ON public.activation_requests;
CREATE TRIGGER trg_send_activation_success_email
  AFTER INSERT OR UPDATE OF status ON public.activation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_send_activation_success_email();