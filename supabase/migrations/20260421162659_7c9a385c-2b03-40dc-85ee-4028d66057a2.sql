-- ============================================================
-- PHASE 3 — ORDER TRACKING ENGINE
-- ============================================================

-- 1. Table d'historique unifié des transitions
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status_domain TEXT NOT NULL CHECK (status_domain IN ('order','shipment','activation','payment','kyc','installation')),
  old_status TEXT,
  new_status TEXT NOT NULL,
  actor_user_id UUID,
  actor_role TEXT,
  actor_name TEXT,
  change_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_osh_order_id ON public.order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_osh_domain ON public.order_status_history(status_domain);
CREATE INDEX IF NOT EXISTS idx_osh_created ON public.order_status_history(created_at DESC);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- Admin / staff lecture totale
CREATE POLICY "Admin staff can view all status history"
ON public.order_status_history FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
);

-- Admin / staff insertion
CREATE POLICY "Admin staff can insert status history"
ON public.order_status_history FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
);

-- Client lecture filtrée par sa propre commande
CREATE POLICY "Clients can view their own order history"
ON public.order_status_history FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_status_history.order_id
      AND o.user_id = auth.uid()
  )
);

-- Service role bypass (triggers + edge functions)
CREATE POLICY "Service role full access"
ON public.order_status_history FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ============================================================
-- 2. Helper : déterminer si une commande est self-install
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_self_install_order(p_installation_type TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_installation_type IN ('auto','ship_to_home') OR p_installation_type IS NULL;
$$;

-- ============================================================
-- 3. Vue order_lifecycle — agrégation unifiée
-- ============================================================
CREATE OR REPLACE VIEW public.order_lifecycle AS
SELECT
  o.id AS order_id,
  o.order_number,
  o.user_id,
  o.status AS order_status,
  o.payment_status,
  o.installation_type,
  public.is_self_install_order(o.installation_type) AS is_self_install,
  o.created_at AS order_created_at,
  o.shipped_at,
  o.appointment_date,
  -- Shipment
  s.id AS shipment_id,
  s.status::text AS shipment_status,
  s.tracking_number,
  s.carrier,
  s.tracking_url,
  s.actual_ship_date,
  s.actual_delivery_date,
  -- Activation
  ar.id AS activation_request_id,
  ar.status AS activation_status,
  ar.activated_at,
  ar.completed_at AS activation_completed_at,
  -- Étape courante (1-6) selon self/pro
  CASE
    WHEN ar.status = 'completed' OR o.status = 'activated' THEN 6
    WHEN public.is_self_install_order(o.installation_type) THEN
      CASE
        WHEN ar.status IN ('in_progress','started') THEN 5
        WHEN s.status::text = 'delivered' THEN 5
        WHEN s.status::text IN ('shipped','in_transit','out_for_delivery') THEN 4
        WHEN o.status IN ('processing','preparing','ready_to_ship') THEN 3
        WHEN o.payment_status = 'paid' THEN 2
        ELSE 1
      END
    ELSE -- Pro
      CASE
        WHEN ar.status IN ('in_progress','started') THEN 5
        WHEN o.appointment_date IS NOT NULL THEN 4
        WHEN o.status IN ('processing','preparing') THEN 3
        WHEN o.payment_status = 'paid' THEN 2
        ELSE 1
      END
  END AS current_step,
  -- Pourcentage (16.67% par étape)
  CASE
    WHEN ar.status = 'completed' OR o.status = 'activated' THEN 100
    WHEN public.is_self_install_order(o.installation_type) THEN
      CASE
        WHEN ar.status IN ('in_progress','started') THEN 83
        WHEN s.status::text = 'delivered' THEN 83
        WHEN s.status::text IN ('shipped','in_transit','out_for_delivery') THEN 67
        WHEN o.status IN ('processing','preparing','ready_to_ship') THEN 50
        WHEN o.payment_status = 'paid' THEN 33
        ELSE 17
      END
    ELSE
      CASE
        WHEN ar.status IN ('in_progress','started') THEN 83
        WHEN o.appointment_date IS NOT NULL THEN 67
        WHEN o.status IN ('processing','preparing') THEN 50
        WHEN o.payment_status = 'paid' THEN 33
        ELSE 17
      END
  END AS progress_percent
FROM public.orders o
LEFT JOIN LATERAL (
  SELECT * FROM public.shipments s2
  WHERE s2.order_id = o.id
  ORDER BY s2.created_at DESC
  LIMIT 1
) s ON true
LEFT JOIN LATERAL (
  SELECT * FROM public.activation_requests ar2
  WHERE ar2.order_id = o.id
  ORDER BY ar2.submitted_at DESC NULLS LAST
  LIMIT 1
) ar ON true;

-- Vue accessible (sécurité héritée des tables sous-jacentes via RLS)
GRANT SELECT ON public.order_lifecycle TO authenticated, anon;

-- ============================================================
-- 4. Trigger : shipments → order_status_history + sync orders.status
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_track_shipment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  v_order_id := NEW.order_id;
  IF v_order_id IS NULL THEN RETURN NEW; END IF;

  -- Log uniquement les vrais changements
  IF TG_OP = 'INSERT' OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.order_status_history(
      order_id, status_domain, old_status, new_status,
      actor_role, change_reason, metadata
    ) VALUES (
      v_order_id, 'shipment',
      CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.status::text END,
      NEW.status::text,
      'system', 'Shipment status sync',
      jsonb_build_object(
        'shipment_id', NEW.id,
        'tracking_number', NEW.tracking_number,
        'carrier', NEW.carrier
      )
    );

    -- Sync orders.status pour delivered/shipped (audit interne, même si pro)
    IF NEW.status::text = 'delivered' THEN
      UPDATE public.orders
      SET status = 'delivered', updated_at = now()
      WHERE id = v_order_id AND status NOT IN ('completed','activated','cancelled');
    ELSIF NEW.status::text IN ('shipped','in_transit') THEN
      UPDATE public.orders
      SET status = 'shipped', shipped_at = COALESCE(shipped_at, now()), updated_at = now()
      WHERE id = v_order_id AND status NOT IN ('delivered','completed','activated','cancelled');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_shipment_status ON public.shipments;
CREATE TRIGGER trg_track_shipment_status
AFTER INSERT OR UPDATE OF status ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.fn_track_shipment_status();

-- ============================================================
-- 5. Trigger : activation_requests → history + sync
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_track_activation_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_id IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.order_status_history(
      order_id, status_domain, old_status, new_status,
      actor_role, change_reason, metadata
    ) VALUES (
      NEW.order_id, 'activation',
      CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.status END,
      NEW.status,
      'system', 'Activation status sync',
      jsonb_build_object('activation_request_id', NEW.id)
    );

    IF NEW.status = 'completed' THEN
      UPDATE public.orders
      SET status = 'activated', updated_at = now()
      WHERE id = NEW.order_id AND status <> 'cancelled';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_activation_status ON public.activation_requests;
CREATE TRIGGER trg_track_activation_status
AFTER INSERT OR UPDATE OF status ON public.activation_requests
FOR EACH ROW EXECUTE FUNCTION public.fn_track_activation_status();

-- ============================================================
-- 6. Trigger : orders.status → history (capture transitions manuelles)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_track_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_status_history(
      order_id, status_domain, old_status, new_status,
      actor_user_id, actor_role, change_reason
    ) VALUES (
      NEW.id, 'order', OLD.status, NEW.status,
      auth.uid(),
      CASE
        WHEN auth.uid() IS NULL THEN 'system'
        WHEN has_role(auth.uid(),'admin'::app_role) THEN 'admin'
        WHEN has_role(auth.uid(),'employee'::app_role) THEN 'employee'
        ELSE 'user'
      END,
      'Order status transition'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_order_status ON public.orders;
CREATE TRIGGER trg_track_order_status
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.fn_track_order_status();

-- ============================================================
-- 7. RPC : transition_order_status (utilisé par boutons admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.transition_order_status(
  p_order_id UUID,
  p_domain TEXT,
  p_new_status TEXT,
  p_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role TEXT;
  v_old_status TEXT;
  v_result JSONB;
BEGIN
  -- Vérification rôle
  IF NOT (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'employee'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
  ) THEN
    RAISE EXCEPTION 'Forbidden: admin or staff role required';
  END IF;

  v_actor_role := CASE
    WHEN has_role(auth.uid(),'admin'::app_role) THEN 'admin'
    WHEN has_role(auth.uid(),'supervisor'::app_role) THEN 'supervisor'
    ELSE 'employee'
  END;

  IF p_domain = 'order' THEN
    SELECT status INTO v_old_status FROM public.orders WHERE id = p_order_id;
    UPDATE public.orders SET status = p_new_status, updated_at = now() WHERE id = p_order_id;

  ELSIF p_domain = 'shipment' THEN
    -- Ne crée pas le shipment ici, suppose qu'il existe (ou met à jour le plus récent)
    UPDATE public.shipments
    SET
      status = p_new_status::text::shipment_status,
      tracking_number = COALESCE(p_metadata->>'tracking_number', tracking_number),
      carrier = COALESCE(p_metadata->>'carrier', carrier),
      actual_ship_date = CASE WHEN p_new_status='shipped' THEN COALESCE(actual_ship_date, CURRENT_DATE) ELSE actual_ship_date END,
      actual_delivery_date = CASE WHEN p_new_status='delivered' THEN COALESCE(actual_delivery_date, CURRENT_DATE) ELSE actual_delivery_date END,
      updated_at = now()
    WHERE order_id = p_order_id
      AND id = (SELECT id FROM public.shipments WHERE order_id = p_order_id ORDER BY created_at DESC LIMIT 1);

  ELSIF p_domain = 'activation' THEN
    UPDATE public.activation_requests
    SET status = p_new_status,
        completed_at = CASE WHEN p_new_status='completed' THEN COALESCE(completed_at, now()) ELSE completed_at END,
        activated_at = CASE WHEN p_new_status IN ('activated','completed') THEN COALESCE(activated_at, now()) ELSE activated_at END,
        updated_at = now()
    WHERE order_id = p_order_id
      AND id = (SELECT id FROM public.activation_requests WHERE order_id = p_order_id ORDER BY submitted_at DESC LIMIT 1);
  ELSE
    RAISE EXCEPTION 'Unknown domain: %', p_domain;
  END IF;

  -- Log explicite (au-delà des triggers automatiques)
  INSERT INTO public.order_status_history(
    order_id, status_domain, old_status, new_status,
    actor_user_id, actor_role, change_reason, metadata
  ) VALUES (
    p_order_id, p_domain, v_old_status, p_new_status,
    auth.uid(), v_actor_role, p_reason, p_metadata
  );

  SELECT jsonb_build_object('success', true, 'order_id', p_order_id, 'domain', p_domain, 'new_status', p_new_status)
  INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_order_status(UUID,TEXT,TEXT,TEXT,JSONB) TO authenticated;