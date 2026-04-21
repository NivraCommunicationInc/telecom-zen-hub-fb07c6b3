-- ============================================================
-- PHASE 3 — HARDENING : validation transitions + cohérence
-- ============================================================

-- ------------------------------------------------------------
-- 1. State machines : transitions valides par domaine
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_valid_status_transition(
  p_domain TEXT,
  p_old_status TEXT,
  p_new_status TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
BEGIN
  -- Idempotence : même statut autorisé (no-op)
  IF p_old_status IS NOT DISTINCT FROM p_new_status THEN
    RETURN TRUE;
  END IF;

  -- Domaine ORDER : pending → confirmed → processing → shipped → delivered → activated
  --                              ↘ cancelled (depuis n'importe quel non-terminal)
  IF p_domain = 'order' THEN
    -- Cancel toujours possible sauf si déjà terminal
    IF p_new_status = 'cancelled' THEN
      RETURN p_old_status NOT IN ('activated','completed','cancelled');
    END IF;
    -- Terminaux ne peuvent pas être quittés
    IF p_old_status IN ('activated','completed','cancelled') THEN
      RETURN FALSE;
    END IF;
    RETURN (p_old_status, p_new_status) IN (
      ('pending','confirmed'),
      ('pending','processing'),
      ('confirmed','processing'),
      ('confirmed','preparing'),
      ('processing','preparing'),
      ('processing','ready_to_ship'),
      ('preparing','ready_to_ship'),
      ('preparing','shipped'),
      ('ready_to_ship','shipped'),
      ('shipped','in_transit'),
      ('shipped','delivered'),
      ('in_transit','delivered'),
      ('delivered','activated'),
      ('delivered','completed'),
      ('activated','completed')
    );
  END IF;

  -- Domaine SHIPMENT : pending → label_created → shipped → in_transit → out_for_delivery → delivered
  IF p_domain = 'shipment' THEN
    IF p_old_status IN ('delivered','cancelled','returned') THEN
      RETURN FALSE;
    END IF;
    IF p_new_status = 'cancelled' THEN
      RETURN p_old_status NOT IN ('delivered','returned');
    END IF;
    RETURN (p_old_status, p_new_status) IN (
      ('pending','label_created'),
      ('pending','shipped'),
      ('label_created','shipped'),
      ('shipped','in_transit'),
      ('shipped','out_for_delivery'),
      ('shipped','delivered'),
      ('in_transit','out_for_delivery'),
      ('in_transit','delivered'),
      ('out_for_delivery','delivered'),
      ('delivered','returned')
    );
  END IF;

  -- Domaine ACTIVATION : pending → in_progress|started → completed
  IF p_domain = 'activation' THEN
    IF p_old_status IN ('completed','cancelled','rejected') THEN
      RETURN FALSE;
    END IF;
    IF p_new_status IN ('cancelled','rejected') THEN
      RETURN TRUE;
    END IF;
    RETURN (p_old_status, p_new_status) IN (
      ('pending','in_progress'),
      ('pending','started'),
      ('pending','assigned'),
      ('assigned','in_progress'),
      ('assigned','started'),
      ('started','in_progress'),
      ('in_progress','completed'),
      ('started','completed')
    );
  END IF;

  -- Domaines non gérés → autoriser pour ne pas casser legacy
  RETURN TRUE;
END;
$$;

-- ------------------------------------------------------------
-- 2. RPC transition_order_status — version durcie
-- ------------------------------------------------------------
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
  v_payment_status TEXT;
  v_installation_type TEXT;
  v_shipment_status TEXT;
  v_order_status TEXT;
BEGIN
  -- Authentification & rôle
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

  -- Snapshot commande pour validations contextuelles
  SELECT status, payment_status, installation_type
    INTO v_order_status, v_payment_status, v_installation_type
  FROM public.orders WHERE id = p_order_id;

  IF v_order_status IS NULL THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  -- ========== Branche par domaine ==========
  IF p_domain = 'order' THEN
    v_old_status := v_order_status;

    -- Validation state machine
    IF NOT public.is_valid_status_transition('order', v_old_status, p_new_status) THEN
      RAISE EXCEPTION 'Invalid order transition: % → %', v_old_status, p_new_status
        USING ERRCODE = '22023';
    END IF;

    -- Garde-fou : pas d'activation sans paiement
    IF p_new_status IN ('activated','completed') AND v_payment_status NOT IN ('paid','captured') THEN
      RAISE EXCEPTION 'Cannot activate order without paid payment_status (current: %)', v_payment_status
        USING ERRCODE = '22023';
    END IF;

    UPDATE public.orders SET status = p_new_status, updated_at = now() WHERE id = p_order_id;

  ELSIF p_domain = 'shipment' THEN
    SELECT status::text INTO v_shipment_status
    FROM public.shipments WHERE order_id = p_order_id
    ORDER BY created_at DESC LIMIT 1;

    v_old_status := COALESCE(v_shipment_status, 'pending');

    IF NOT public.is_valid_status_transition('shipment', v_old_status, p_new_status) THEN
      RAISE EXCEPTION 'Invalid shipment transition: % → %', v_old_status, p_new_status
        USING ERRCODE = '22023';
    END IF;

    -- Garde-fou : pas d'expédition avant paiement
    IF p_new_status IN ('shipped','in_transit','out_for_delivery','delivered')
       AND v_payment_status NOT IN ('paid','captured') THEN
      RAISE EXCEPTION 'Cannot ship before payment is captured (payment_status: %)', v_payment_status
        USING ERRCODE = '22023';
    END IF;

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
    SELECT status INTO v_old_status
    FROM public.activation_requests WHERE order_id = p_order_id
    ORDER BY submitted_at DESC NULLS LAST LIMIT 1;

    v_old_status := COALESCE(v_old_status, 'pending');

    IF NOT public.is_valid_status_transition('activation', v_old_status, p_new_status) THEN
      RAISE EXCEPTION 'Invalid activation transition: % → %', v_old_status, p_new_status
        USING ERRCODE = '22023';
    END IF;

    -- Garde-fou : pour SELF-install, livraison requise avant activation
    IF p_new_status = 'completed'
       AND public.is_self_install_order(v_installation_type) THEN
      SELECT status::text INTO v_shipment_status
      FROM public.shipments WHERE order_id = p_order_id
      ORDER BY created_at DESC LIMIT 1;

      IF v_shipment_status IS NULL OR v_shipment_status NOT IN ('delivered') THEN
        RAISE EXCEPTION 'Cannot complete self-install activation before delivery (shipment: %)',
          COALESCE(v_shipment_status,'none')
          USING ERRCODE = '22023';
      END IF;
    END IF;

    -- Garde-fou paiement
    IF p_new_status = 'completed' AND v_payment_status NOT IN ('paid','captured') THEN
      RAISE EXCEPTION 'Cannot complete activation before payment (payment_status: %)', v_payment_status
        USING ERRCODE = '22023';
    END IF;

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

  -- Log
  INSERT INTO public.order_status_history(
    order_id, status_domain, old_status, new_status,
    actor_user_id, actor_role, change_reason, metadata
  ) VALUES (
    p_order_id, p_domain, v_old_status, p_new_status,
    auth.uid(), v_actor_role, p_reason, p_metadata
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'domain', p_domain,
    'old_status', v_old_status,
    'new_status', p_new_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_order_status(UUID,TEXT,TEXT,TEXT,JSONB) TO authenticated;

-- ------------------------------------------------------------
-- 3. Trigger guard : empêche shipment.delivered si payment != paid
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_guard_shipment_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_status TEXT;
BEGIN
  IF NEW.order_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.status::text IN ('shipped','in_transit','out_for_delivery','delivered')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT payment_status INTO v_payment_status
    FROM public.orders WHERE id = NEW.order_id;

    IF v_payment_status NOT IN ('paid','captured') THEN
      RAISE EXCEPTION 'Shipment cannot reach % before order payment (current payment_status: %)',
        NEW.status, COALESCE(v_payment_status, 'null')
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_shipment_consistency ON public.shipments;
CREATE TRIGGER trg_guard_shipment_consistency
BEFORE INSERT OR UPDATE OF status ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_shipment_consistency();

-- ------------------------------------------------------------
-- 4. Trigger guard : activation 'completed' nécessite livraison (self) + paiement
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_guard_activation_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_status TEXT;
  v_installation_type TEXT;
  v_shipment_status TEXT;
BEGIN
  IF NEW.order_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status <> 'completed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN RETURN NEW; END IF;

  SELECT payment_status, installation_type
    INTO v_payment_status, v_installation_type
  FROM public.orders WHERE id = NEW.order_id;

  IF v_payment_status NOT IN ('paid','captured') THEN
    RAISE EXCEPTION 'Activation cannot complete before payment (payment_status: %)', v_payment_status
      USING ERRCODE = '22023';
  END IF;

  IF public.is_self_install_order(v_installation_type) THEN
    SELECT status::text INTO v_shipment_status
    FROM public.shipments WHERE order_id = NEW.order_id
    ORDER BY created_at DESC LIMIT 1;

    IF v_shipment_status IS NULL OR v_shipment_status <> 'delivered' THEN
      RAISE EXCEPTION 'Self-install activation cannot complete before equipment delivery (shipment: %)',
        COALESCE(v_shipment_status,'none')
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_activation_consistency ON public.activation_requests;
CREATE TRIGGER trg_guard_activation_consistency
BEFORE INSERT OR UPDATE OF status ON public.activation_requests
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_activation_consistency();

-- ------------------------------------------------------------
-- 5. Trigger guard : orders.status — empêche transitions invalides directes
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_guard_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- System / triggers (auth.uid() NULL) bypass — sync interne
    IF auth.uid() IS NULL THEN RETURN NEW; END IF;

    IF NOT public.is_valid_status_transition('order', OLD.status, NEW.status) THEN
      RAISE EXCEPTION 'Invalid order.status transition: % → %', OLD.status, NEW.status
        USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_order_status_transition ON public.orders;
CREATE TRIGGER trg_guard_order_status_transition
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_order_status_transition();