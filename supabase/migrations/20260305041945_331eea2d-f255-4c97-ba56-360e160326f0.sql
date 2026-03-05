-- ============================================================================
-- 1) SERVICE_ADDRESSES table for multi-address support
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.service_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Principal',
  address_line TEXT NOT NULL,
  city TEXT,
  province TEXT DEFAULT 'QC',
  postal_code TEXT,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.service_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_service_addresses" ON public.service_addresses
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "client_read_own_service_addresses" ON public.service_addresses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM accounts a
      WHERE a.id = service_addresses.account_id
        AND a.client_id = auth.uid()
    )
  );

-- ============================================================================
-- 2) Add address_id + order_id to billing_subscriptions
-- ============================================================================
DO $$ BEGIN
  ALTER TABLE public.billing_subscriptions
    ADD COLUMN address_id UUID REFERENCES public.service_addresses(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.billing_subscriptions
    ADD COLUMN order_id UUID REFERENCES public.orders(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================================
-- 3) UNIQUE guard: max 1 active sub per customer+address+service_category
-- ============================================================================
DROP INDEX IF EXISTS idx_unique_sub_per_address_category;
CREATE UNIQUE INDEX idx_unique_sub_per_address_category
  ON public.billing_subscriptions (customer_id, address_id, service_category)
  WHERE status IN ('active', 'pending', 'suspended')
    AND service_category IN ('internet', 'tv', 'combo_tv_internet')
    AND address_id IS NOT NULL;

-- ============================================================================
-- 4) Idempotent service provisioning unique index
-- ============================================================================
DROP INDEX IF EXISTS idx_billing_sub_services_unique;
CREATE UNIQUE INDEX idx_billing_sub_services_unique
  ON public.billing_subscription_services (subscription_id, service_code)
  WHERE is_active = true;

-- ============================================================================
-- 5) GENERIC provision_services_for_order
-- ============================================================================
CREATE OR REPLACE FUNCTION public.provision_services_for_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_customer_id UUID;
  v_subscription_id UUID;
  v_line_items JSONB;
  v_item JSONB;
  v_services_created INT := 0;
  v_equipment_created INT := 0;
  v_plan_name TEXT;
  v_plan_code TEXT;
  v_plan_price NUMERIC := 0;
  v_cycle_start DATE;
  v_cycle_end DATE;
  v_item_type TEXT;
  v_item_period TEXT;
  v_service_code TEXT;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  v_line_items := v_order.equipment_details->'line_items';
  IF v_line_items IS NULL OR jsonb_array_length(v_line_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No line_items in equipment_details');
  END IF;

  SELECT id INTO v_customer_id FROM billing_customers WHERE user_id = v_order.user_id LIMIT 1;
  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No billing_customer for user');
  END IF;

  v_plan_name := COALESCE(v_order.service_type, 'Service');
  v_plan_code := 'order-' || COALESCE(v_order.order_number, v_order.id::TEXT);
  v_cycle_start := CURRENT_DATE;
  v_cycle_end := CURRENT_DATE + INTERVAL '30 days';

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_line_items)
  LOOP
    IF COALESCE(v_item->>'period', 'one_time') = 'monthly' THEN
      v_plan_price := v_plan_price + COALESCE((v_item->>'unit_price')::NUMERIC, 0) * COALESCE((v_item->>'qty')::INT, 1);
    END IF;
  END LOOP;

  SELECT id INTO v_subscription_id FROM billing_subscriptions WHERE customer_id = v_customer_id AND plan_code = v_plan_code;

  IF v_subscription_id IS NULL THEN
    SELECT id INTO v_subscription_id FROM billing_subscriptions WHERE customer_id = v_customer_id AND status = 'pending' AND plan_name = v_plan_name LIMIT 1;
    IF v_subscription_id IS NOT NULL THEN
      UPDATE billing_subscriptions SET plan_code = v_plan_code, plan_price = v_plan_price, cycle_start_date = v_cycle_start, cycle_end_date = v_cycle_end, status = 'active', service_category = COALESCE(v_order.category, service_category), order_id = p_order_id, updated_at = NOW() WHERE id = v_subscription_id;
    ELSE
      INSERT INTO billing_subscriptions (customer_id, plan_code, plan_name, plan_price, cycle_start_date, cycle_end_date, status, service_category, order_id) VALUES (v_customer_id, v_plan_code, v_plan_name, v_plan_price, v_cycle_start, v_cycle_end, 'active', v_order.category, p_order_id) RETURNING id INTO v_subscription_id;
    END IF;
  ELSE
    UPDATE billing_subscriptions SET status = 'active', plan_price = v_plan_price, order_id = p_order_id, updated_at = NOW() WHERE id = v_subscription_id;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_line_items)
  LOOP
    v_item_type := COALESCE(v_item->>'type', 'other');
    v_item_period := COALESCE(v_item->>'period', 'one_time');
    IF v_item_type IN ('fee', 'discount', 'tax', 'promo') THEN CONTINUE; END IF;

    v_service_code := COALESCE(v_item->>'ref_id', v_item_type || '-' || md5(COALESCE(v_item->>'name', 'unknown')));

    INSERT INTO billing_subscription_services (subscription_id, service_name, service_code, service_type, unit_price, quantity, is_active)
    VALUES (v_subscription_id, COALESCE(v_item->>'name', v_item_type), v_service_code, CASE WHEN v_item_period = 'monthly' THEN 'recurring' ELSE 'one_time' END, COALESCE((v_item->>'unit_price')::NUMERIC, 0), COALESCE((v_item->>'qty')::INT, 1), true)
    ON CONFLICT (subscription_id, service_code) WHERE is_active = true DO NOTHING;

    IF FOUND THEN
      IF v_item_period = 'monthly' THEN v_services_created := v_services_created + 1;
      ELSE v_equipment_created := v_equipment_created + 1; END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'subscription_id', v_subscription_id, 'services_created', v_services_created, 'equipment_created', v_equipment_created, 'plan_name', v_plan_name, 'plan_price', v_plan_price);
END;
$$;

-- ============================================================================
-- 6) Trigger: auto-provision on order completion
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_provision_on_order_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NEW.status IN ('completed', 'installation_completed')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('completed', 'installation_completed')) THEN
    IF NEW.equipment_details IS NOT NULL
       AND NEW.equipment_details->'line_items' IS NOT NULL
       AND jsonb_array_length(NEW.equipment_details->'line_items') > 0 THEN
      v_result := provision_services_for_order(NEW.id);
      IF NOT COALESCE((v_result->>'success')::BOOLEAN, false) THEN
        INSERT INTO billing_system_alerts (alert_type, entity_type, entity_id, details)
        VALUES ('provisioning_failed', 'order', NEW.id::text, jsonb_build_object('order_number', NEW.order_number, 'error', v_result->>'error', 'attempted_status', NEW.status, 'user_id', NEW.user_id));
        NEW.status := 'provisioning_failed';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_provision_on_completion ON orders;
CREATE TRIGGER trg_provision_on_completion BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION trg_provision_on_order_completion();

-- ============================================================================
-- 7) protect_subscription_activation — allow provisioning paths
-- ============================================================================
CREATE OR REPLACE FUNCTION public.protect_subscription_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_paid BOOLEAN := false;
  v_order_ok BOOLEAN := false;
BEGIN
  IF NEW.status = 'active' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'active') THEN
    -- Check paid invoice for subscription
    SELECT EXISTS (SELECT 1 FROM billing_invoices WHERE subscription_id = NEW.id AND status IN ('paid', 'paid_by_promo')) INTO v_has_paid;
    IF v_has_paid THEN RETURN NEW; END IF;

    -- Check paid invoice for order
    IF NEW.order_id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM billing_invoices WHERE order_id = NEW.order_id AND status IN ('paid', 'paid_by_promo')) INTO v_has_paid;
      IF v_has_paid THEN RETURN NEW; END IF;
      SELECT EXISTS (SELECT 1 FROM orders WHERE id = NEW.order_id AND (payment_status IN ('paid', 'authorized', 'captured') OR COALESCE(total_amount, 0) = 0)) INTO v_order_ok;
      IF v_order_ok THEN RETURN NEW; END IF;
    END IF;

    -- Check via plan_code
    IF NEW.plan_code LIKE 'order-%' THEN
      SELECT EXISTS (SELECT 1 FROM orders WHERE order_number = REPLACE(NEW.plan_code, 'order-', '') AND (payment_status IN ('paid', 'authorized', 'captured') OR COALESCE(total_amount, 0) = 0)) INTO v_order_ok;
      IF v_order_ok THEN RETURN NEW; END IF;
    END IF;

    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_sub_activation ON billing_subscriptions;
CREATE TRIGGER trg_protect_sub_activation BEFORE UPDATE ON billing_subscriptions FOR EACH ROW EXECUTE FUNCTION protect_subscription_activation();
DROP TRIGGER IF EXISTS trg_protect_sub_insert_activation ON billing_subscriptions;
CREATE TRIGGER trg_protect_sub_insert_activation BEFORE INSERT ON billing_subscriptions FOR EACH ROW EXECUTE FUNCTION protect_subscription_activation();