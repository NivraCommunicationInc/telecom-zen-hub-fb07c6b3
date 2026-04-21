-- ============================================================
-- Phase 2: Shipping address + activation date on orders
-- ============================================================

-- Add shipping address columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ship_to_different_address BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_first_name TEXT,
  ADD COLUMN IF NOT EXISTS shipping_last_name TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address_line TEXT,
  ADD COLUMN IF NOT EXISTS shipping_apartment TEXT,
  ADD COLUMN IF NOT EXISTS shipping_city TEXT,
  ADD COLUMN IF NOT EXISTS shipping_province TEXT,
  ADD COLUMN IF NOT EXISTS shipping_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS shipping_instructions TEXT;

-- Add activation date columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS activation_preference TEXT NOT NULL DEFAULT 'ASAP',
  ADD COLUMN IF NOT EXISTS requested_activation_date DATE;

-- Add installation details (bonus) on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS installation_details JSONB DEFAULT '{}'::jsonb;

-- Sanity constraint: activation_preference allowed values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_activation_preference_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_activation_preference_check
      CHECK (activation_preference IN ('ASAP', 'SCHEDULED'));
  END IF;
END$$;

-- Index for staff dashboards filtering by requested activation date
CREATE INDEX IF NOT EXISTS idx_orders_requested_activation_date
  ON public.orders (requested_activation_date)
  WHERE requested_activation_date IS NOT NULL;

-- ============================================================
-- Update orchestrate_order to support shipping override + activation date
-- (resolved shipping address + activation note are passed to shipments / installation_jobs)
-- ============================================================

CREATE OR REPLACE FUNCTION public.orchestrate_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_existing_items_count int;
  v_existing_jobs_count int;
  v_existing_shipments_count int;
  v_items_created int := 0;
  v_jobs_created int := 0;
  v_shipments_created int := 0;
  v_has_internet boolean := false;
  v_has_tv boolean := false;
  v_has_mobile boolean := false;

  -- resolved shipping fields (override or fallback to service address)
  v_ship_first_name text;
  v_ship_last_name text;
  v_ship_address text;
  v_ship_apartment text;
  v_ship_city text;
  v_ship_province text;
  v_ship_postal text;
  v_ship_instructions text;
  v_activation_note text;
BEGIN
  -- Lock order row
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'order_id', p_order_id,
      'error', 'Order not found'
    );
  END IF;

  -- Idempotency: if items already exist, treat as already orchestrated
  SELECT COUNT(*) INTO v_existing_items_count
  FROM public.order_items WHERE order_id = p_order_id;

  SELECT COUNT(*) INTO v_existing_jobs_count
  FROM public.provisioning_jobs WHERE order_id = p_order_id;

  SELECT COUNT(*) INTO v_existing_shipments_count
  FROM public.shipments WHERE order_id = p_order_id;

  IF v_existing_items_count > 0 OR v_existing_jobs_count > 0 OR v_existing_shipments_count > 0 THEN
    RETURN jsonb_build_object(
      'status', 'already_orchestrated',
      'order_id', p_order_id,
      'items_created', v_existing_items_count,
      'jobs_created', v_existing_jobs_count,
      'shipments_created', v_existing_shipments_count
    );
  END IF;

  -- Detect service categories from order
  v_has_internet := COALESCE(v_order.has_internet, false)
    OR (v_order.service_type IN ('internet', 'bundle'));
  v_has_tv := COALESCE(v_order.has_tv, false)
    OR (v_order.service_type IN ('tv', 'bundle'));
  v_has_mobile := COALESCE(v_order.has_mobile, false)
    OR (v_order.service_type = 'mobile');

  -- ----------------------------------------------------------
  -- Resolve shipping address
  -- If ship_to_different_address = true and override fields are set,
  -- use them; else fallback to service address (current behavior).
  -- ----------------------------------------------------------
  IF v_order.ship_to_different_address = true
     AND v_order.shipping_address_line IS NOT NULL
     AND length(trim(v_order.shipping_address_line)) > 0 THEN
    v_ship_first_name := v_order.shipping_first_name;
    v_ship_last_name  := v_order.shipping_last_name;
    v_ship_address    := COALESCE(v_order.shipping_address_line, '')
                         || CASE
                              WHEN v_order.shipping_apartment IS NOT NULL
                                   AND length(trim(v_order.shipping_apartment)) > 0
                              THEN ', ' || v_order.shipping_apartment
                              ELSE ''
                            END;
    v_ship_apartment  := v_order.shipping_apartment;
    v_ship_city       := v_order.shipping_city;
    v_ship_province   := COALESCE(v_order.shipping_province, 'QC');
    v_ship_postal     := v_order.shipping_postal_code;
    v_ship_instructions := v_order.shipping_instructions;
  ELSE
    v_ship_first_name := v_order.first_name;
    v_ship_last_name  := v_order.last_name;
    v_ship_address    := v_order.service_address;
    v_ship_apartment  := NULL;
    v_ship_city       := v_order.service_city;
    v_ship_province   := COALESCE(v_order.service_province, 'QC');
    v_ship_postal     := v_order.service_postal_code;
    v_ship_instructions := NULL;
  END IF;

  -- Activation note (added to provisioning_jobs / installation notes)
  IF v_order.activation_preference = 'SCHEDULED'
     AND v_order.requested_activation_date IS NOT NULL THEN
    v_activation_note := 'Client requested activation on '
                         || to_char(v_order.requested_activation_date, 'YYYY-MM-DD');
  ELSE
    v_activation_note := 'Activation ASAP';
  END IF;

  -- ----------------------------------------------------------
  -- Create order_items (1 line per service)
  -- ----------------------------------------------------------
  IF v_has_internet THEN
    INSERT INTO public.order_items (
      order_id, item_type, item_name, quantity, unit_price, total_price
    )
    VALUES (
      p_order_id,
      'internet',
      COALESCE(v_order.internet_plan_name, 'Internet'),
      1,
      COALESCE(v_order.internet_plan_price, 0),
      COALESCE(v_order.internet_plan_price, 0)
    );
    v_items_created := v_items_created + 1;
  END IF;

  IF v_has_tv THEN
    INSERT INTO public.order_items (
      order_id, item_type, item_name, quantity, unit_price, total_price
    )
    VALUES (
      p_order_id,
      'tv',
      COALESCE(v_order.tv_plan_name, 'TV'),
      1,
      COALESCE(v_order.tv_plan_price, 0),
      COALESCE(v_order.tv_plan_price, 0)
    );
    v_items_created := v_items_created + 1;
  END IF;

  IF v_has_mobile THEN
    INSERT INTO public.order_items (
      order_id, item_type, item_name, quantity, unit_price, total_price
    )
    VALUES (
      p_order_id,
      'mobile',
      COALESCE(v_order.mobile_plan_name, 'Mobile'),
      1,
      COALESCE(v_order.mobile_plan_price, 0),
      COALESCE(v_order.mobile_plan_price, 0)
    );
    v_items_created := v_items_created + 1;
  END IF;

  -- ----------------------------------------------------------
  -- Create provisioning_jobs (one per service)
  -- ----------------------------------------------------------
  IF v_has_internet THEN
    INSERT INTO public.provisioning_jobs (
      order_id, job_type, status, notes
    )
    VALUES (p_order_id, 'internet_provisioning', 'pending', v_activation_note);
    v_jobs_created := v_jobs_created + 1;
  END IF;

  IF v_has_tv THEN
    INSERT INTO public.provisioning_jobs (
      order_id, job_type, status, notes
    )
    VALUES (p_order_id, 'tv_provisioning', 'pending', v_activation_note);
    v_jobs_created := v_jobs_created + 1;
  END IF;

  IF v_has_mobile THEN
    INSERT INTO public.provisioning_jobs (
      order_id, job_type, status, notes
    )
    VALUES (p_order_id, 'mobile_provisioning', 'pending', v_activation_note);
    v_jobs_created := v_jobs_created + 1;
  END IF;

  -- ----------------------------------------------------------
  -- Create shipments (1 shipment per order, equipment grouped)
  -- ----------------------------------------------------------
  IF v_has_internet OR v_has_tv OR v_has_mobile THEN
    INSERT INTO public.shipments (
      order_id,
      ship_to_first_name,
      ship_to_last_name,
      ship_to_address,
      ship_to_city,
      ship_to_province,
      ship_to_postal_code,
      shipping_instructions,
      status
    )
    VALUES (
      p_order_id,
      v_ship_first_name,
      v_ship_last_name,
      v_ship_address,
      v_ship_city,
      v_ship_province,
      v_ship_postal,
      v_ship_instructions,
      'pending'
    );
    v_shipments_created := 1;
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
$$;