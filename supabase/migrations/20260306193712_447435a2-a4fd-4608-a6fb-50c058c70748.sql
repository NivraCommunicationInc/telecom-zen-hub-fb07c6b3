CREATE OR REPLACE FUNCTION public.orchestrate_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_line RECORD;
  v_item_num INT := 0;
  v_item_id UUID;
  v_internet_item_id UUID;
  v_job_id UUID;
  v_internet_job_id UUID;
  v_tv_activate_job_id UUID;
  v_shipment_id UUID;
  v_items_created INT := 0;
  v_jobs_created INT := 0;
  v_shipments_created INT := 0;
  v_has_internet BOOLEAN := FALSE;
  v_has_tv BOOLEAN := FALSE;
  v_has_mobile BOOLEAN := FALSE;
  v_fulfillment fulfillment_type;
  v_line_items JSONB;
  v_equipment_details JSONB;
  v_elem JSONB;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'ORDER_NOT_FOUND');
  END IF;

  IF EXISTS (SELECT 1 FROM order_items WHERE order_id = p_order_id LIMIT 1) THEN
    RETURN jsonb_build_object('status', 'already_orchestrated', 'order_id', p_order_id);
  END IF;

  v_equipment_details := v_order.equipment_details::jsonb;
  v_line_items := COALESCE(v_equipment_details->'line_items', '[]'::jsonb);

  v_fulfillment := CASE
    WHEN v_order.installation_type IN ('technician', 'tech') THEN 'technician'::fulfillment_type
    WHEN v_order.installation_type IN ('pickup', 'store') THEN 'pickup'::fulfillment_type
    ELSE 'ship'::fulfillment_type
  END;

  -- PASS 1: Create order_items from line_items
  FOR v_elem IN SELECT value FROM jsonb_array_elements(v_line_items)
  LOOP
    v_item_num := v_item_num + 1;
    DECLARE
      v_cat TEXT := COALESCE(v_elem->>'category', 'service');
      v_type TEXT := LOWER(COALESCE(v_elem->>'type', 'other'));
      v_svc_type order_item_service_type;
      v_is_recurring BOOLEAN;
      v_period TEXT := COALESCE(v_elem->>'period', 'monthly');
      v_unit_price NUMERIC;
      v_qty INT;
    BEGIN
      v_svc_type := CASE
        WHEN v_type = 'internet' THEN 'internet'::order_item_service_type
        WHEN v_type = 'tv' THEN 'tv'::order_item_service_type
        WHEN v_type = 'mobile' THEN 'mobile'::order_item_service_type
        WHEN v_type = 'streaming' THEN 'streaming'::order_item_service_type
        WHEN v_type = 'security' THEN 'security'::order_item_service_type
        WHEN v_cat = 'equipment' THEN 'equipment'::order_item_service_type
        WHEN v_cat IN ('fee', 'discount') THEN 'fee'::order_item_service_type
        ELSE 'addon'::order_item_service_type
      END;

      v_is_recurring := v_period IN ('monthly', '30_days');
      v_unit_price := COALESCE((v_elem->>'unit_price')::numeric, 0);
      v_qty := COALESCE((v_elem->>'qty')::int, 1);

      INSERT INTO order_items (
        order_id, item_number, service_type, plan_name, plan_code,
        unit_price, quantity, line_total, is_recurring,
        fulfillment_type, status, description, metadata
      ) VALUES (
        p_order_id, v_item_num, v_svc_type,
        COALESCE(v_elem->>'name', 'Item'),
        v_elem->>'ref_id',
        v_unit_price, v_qty, v_unit_price * v_qty,
        v_is_recurring,
        CASE WHEN v_cat = 'service' THEN v_fulfillment ELSE NULL END,
        'pending'::order_item_status,
        v_elem->>'description',
        jsonb_build_object('source_category', v_cat, 'source_type', v_type, 'period', v_period)
      )
      RETURNING id INTO v_item_id;
      v_items_created := v_items_created + 1;

      IF v_type = 'internet' THEN v_has_internet := TRUE; v_internet_item_id := v_item_id; END IF;
      IF v_type = 'tv' THEN v_has_tv := TRUE; END IF;
      IF v_type = 'mobile' THEN v_has_mobile := TRUE; END IF;
    END;
  END LOOP;

  -- Fallback: create from order-level service_type if no line_items
  IF v_items_created = 0 THEN
    DECLARE
      v_svc TEXT := LOWER(COALESCE(v_order.service_type, ''));
    BEGIN
      INSERT INTO order_items (
        order_id, item_number, service_type, plan_name,
        unit_price, quantity, line_total, is_recurring,
        fulfillment_type, status
      ) VALUES (
        p_order_id, 1,
        CASE
          WHEN v_svc LIKE '%internet%' THEN 'internet'::order_item_service_type
          WHEN v_svc LIKE '%tv%' OR v_svc LIKE '%télé%' THEN 'tv'::order_item_service_type
          WHEN v_svc LIKE '%mobile%' THEN 'mobile'::order_item_service_type
          ELSE 'addon'::order_item_service_type
        END,
        COALESCE(v_order.service_type, 'Service Nivra'),
        COALESCE(v_order.subtotal, 0), 1, COALESCE(v_order.subtotal, 0),
        TRUE, v_fulfillment, 'pending'::order_item_status
      )
      RETURNING id INTO v_item_id;
      v_items_created := 1;
      IF v_svc LIKE '%internet%' THEN v_has_internet := TRUE; v_internet_item_id := v_item_id; END IF;
      IF v_svc LIKE '%tv%' OR v_svc LIKE '%télé%' THEN v_has_tv := TRUE; END IF;
      IF v_svc LIKE '%mobile%' THEN v_has_mobile := TRUE; END IF;
    END;
  END IF;

  -- PASS 2: Provisioning jobs with dependency graph
  IF v_has_internet THEN
    INSERT INTO provisioning_jobs (
      order_id, order_item_id, job_type, job_label, priority, status
    ) VALUES (
      p_order_id, v_internet_item_id,
      'INTERNET_ACTIVATE', 'Activation Internet', 10, 'queued'
    ) RETURNING id INTO v_internet_job_id;
    v_jobs_created := v_jobs_created + 1;
  END IF;

  IF v_has_tv THEN
    DECLARE
      v_tv_item_id UUID;
      v_dep UUID := NULL;
    BEGIN
      SELECT id INTO v_tv_item_id FROM order_items
        WHERE order_id = p_order_id AND service_type = 'tv' LIMIT 1;
      IF v_has_internet THEN v_dep := v_internet_job_id; END IF;

      INSERT INTO provisioning_jobs (
        order_id, order_item_id, job_type, job_label, priority,
        status, depends_on_job_id
      ) VALUES (
        p_order_id, v_tv_item_id,
        'TV_ACTIVATE', 'Activation TV', 20,
        CASE WHEN v_dep IS NOT NULL THEN 'waiting_dependency' ELSE 'queued' END,
        v_dep
      ) RETURNING id INTO v_tv_activate_job_id;
      v_jobs_created := v_jobs_created + 1;

      INSERT INTO provisioning_jobs (
        order_id, order_item_id, job_type, job_label, priority,
        status, depends_on_job_id
      ) VALUES (
        p_order_id, v_tv_item_id,
        'CHANNEL_PUSH', 'Configuration chaînes', 25,
        'waiting_dependency', v_tv_activate_job_id
      );
      v_jobs_created := v_jobs_created + 1;
    END;
  END IF;

  IF v_has_mobile THEN
    DECLARE
      v_mob_item_id UUID;
      v_mob_job_id UUID;
      v_has_port_in BOOLEAN := FALSE;
    BEGIN
      SELECT id INTO v_mob_item_id FROM order_items
        WHERE order_id = p_order_id AND service_type = 'mobile' LIMIT 1;

      v_has_port_in := (v_order.port_request IS NOT NULL 
        AND (v_order.port_request::jsonb->>'port_in')::text = 'true');

      INSERT INTO provisioning_jobs (
        order_id, order_item_id, job_type, job_label, priority, status
      ) VALUES (
        p_order_id, v_mob_item_id,
        'MOBILE_ACTIVATE', 'Activation Mobile', 5, 'queued'
      ) RETURNING id INTO v_mob_job_id;
      v_jobs_created := v_jobs_created + 1;

      IF v_has_port_in THEN
        INSERT INTO provisioning_jobs (
          order_id, order_item_id, job_type, job_label, priority,
          status, depends_on_job_id, result_data
        ) VALUES (
          p_order_id, v_mob_item_id,
          'PORT_IN', 'Portage numéro', 6,
          'waiting_dependency', v_mob_job_id,
          v_order.port_request::jsonb
        );
        v_jobs_created := v_jobs_created + 1;
      END IF;
    END;
  END IF;

  -- PASS 3: Shipments
  DECLARE
    v_needs_shipment BOOLEAN;
  BEGIN
    SELECT EXISTS(
      SELECT 1 FROM order_items WHERE order_id = p_order_id AND service_type = 'equipment'
    ) INTO v_needs_shipment;

    IF v_needs_shipment OR v_fulfillment = 'ship'::fulfillment_type THEN
      INSERT INTO shipments (
        order_id, customer_id, status,
        ship_to_address, ship_to_city,
        ship_to_province, ship_to_postal_code,
        notes
      ) VALUES (
        p_order_id, v_order.user_id, 'pending',
        v_order.shipping_address, v_order.shipping_city,
        v_order.shipping_province, v_order.shipping_postal_code,
        'Auto-created by order orchestration'
      ) RETURNING id INTO v_shipment_id;
      v_shipments_created := 1;

      UPDATE order_items SET shipment_id = v_shipment_id
      WHERE order_id = p_order_id AND service_type = 'equipment';
    END IF;
  END;

  -- PASS 4: Update order status
  IF v_order.status IN ('pending', 'pending_verification', 'draft') THEN
    UPDATE orders SET status = 'submitted', updated_at = NOW()
    WHERE id = p_order_id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'orchestrated',
    'order_id', p_order_id,
    'items_created', v_items_created,
    'jobs_created', v_jobs_created,
    'shipments_created', v_shipments_created,
    'has_internet', v_has_internet,
    'has_tv', v_has_tv,
    'has_mobile', v_has_mobile
  );
END;
$$