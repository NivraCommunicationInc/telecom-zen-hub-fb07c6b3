
-- ============================================================
-- STABILIZATION DAY 1: Order Automation Engine
-- Extend existing subscriptions table + automation trigger
-- ============================================================

-- 1. Extend existing subscriptions table with canonical fields
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS service_type text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS monthly_price numeric(10,2) DEFAULT 0;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS subscription_number text;

-- Subscription number sequence
CREATE SEQUENCE IF NOT EXISTS public.subscription_number_seq START WITH 1001;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_account ON public.subscriptions(account_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_order ON public.subscriptions(order_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- 2. Automation log table
CREATE TABLE IF NOT EXISTS public.order_automation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_automation_log_order ON public.order_automation_log(order_id);

ALTER TABLE public.order_automation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access on order_automation_log"
  ON public.order_automation_log FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees read order_automation_log"
  ON public.order_automation_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'employee'));

-- 3. Automation trigger function
CREATE OR REPLACE FUNCTION public.fn_automate_order_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_id uuid;
  v_equip_id uuid;
  v_job_id uuid;
  v_service_type text;
  v_plan_name text;
  v_monthly_price numeric;
  v_account_id uuid;
  v_needs_router boolean := false;
  v_needs_terminal boolean := false;
  v_needs_sim boolean := false;
  v_needs_installation boolean := false;
  v_address_id uuid;
BEGIN
  -- Only fire when status transitions TO 'confirmed'
  IF NEW.status <> 'confirmed' OR (OLD.status IS NOT NULL AND OLD.status = 'confirmed') THEN
    RETURN NEW;
  END IF;

  v_service_type := NEW.service_type;
  v_account_id := NEW.account_id;
  v_monthly_price := COALESCE(NEW.subtotal, NEW.total_amount, 0);
  v_address_id := NEW.service_location_id;

  v_plan_name := initcap(replace(v_service_type, '_', ' '));

  -- ═══ STEP 1: Create subscription (idempotent) ═══
  SELECT id INTO v_sub_id FROM public.subscriptions WHERE order_id = NEW.id LIMIT 1;

  IF v_sub_id IS NULL THEN
    INSERT INTO public.subscriptions (
      account_id, order_id, user_id, service_type, plan_name, status,
      monthly_price, billing_cycle, start_date, next_billing_date,
      subscription_number
    )
    VALUES (
      v_account_id, NEW.id, NEW.user_id, v_service_type, v_plan_name, 'active',
      v_monthly_price, 'monthly', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
      'SUB-' || lpad(nextval('subscription_number_seq')::text, 6, '0')
    )
    RETURNING id INTO v_sub_id;

    INSERT INTO public.order_automation_log (order_id, action, entity_type, entity_id, details)
    VALUES (NEW.id, 'subscription_created', 'subscription', v_sub_id,
      jsonb_build_object('service_type', v_service_type, 'plan_name', v_plan_name, 'monthly_price', v_monthly_price));
  END IF;

  -- ═══ STEP 2: Determine equipment needs ═══
  IF v_service_type IN ('internet', 'combo', 'internet_tv', 'internet_mobile', 'internet_tv_mobile') THEN
    v_needs_router := true;
  END IF;
  IF v_service_type IN ('tv', 'combo', 'internet_tv', 'internet_tv_mobile', 'television') THEN
    v_needs_terminal := true;
  END IF;
  IF v_service_type IN ('mobile', 'internet_mobile', 'internet_tv_mobile') THEN
    v_needs_sim := true;
  END IF;

  -- ═══ STEP 3: Reserve equipment (FIFO, row-locked) ═══
  IF v_needs_router THEN
    SELECT id INTO v_equip_id FROM public.equipment_inventory
    WHERE category = 'router' AND status = 'in_stock' AND order_id IS NULL
    ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;

    IF v_equip_id IS NOT NULL THEN
      UPDATE public.equipment_inventory
      SET status = 'reserved', order_id = NEW.id, account_id = v_account_id,
          address_id = v_address_id, assigned_at = now(), updated_at = now()
      WHERE id = v_equip_id;

      INSERT INTO public.order_automation_log (order_id, action, entity_type, entity_id, details)
      VALUES (NEW.id, 'equipment_reserved', 'equipment_inventory', v_equip_id,
        jsonb_build_object('category', 'router'));
    END IF;
  END IF;

  IF v_needs_terminal THEN
    SELECT id INTO v_equip_id FROM public.equipment_inventory
    WHERE category = 'terminal' AND status = 'in_stock' AND order_id IS NULL
    ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;

    IF v_equip_id IS NOT NULL THEN
      UPDATE public.equipment_inventory
      SET status = 'reserved', order_id = NEW.id, account_id = v_account_id,
          address_id = v_address_id, assigned_at = now(), updated_at = now()
      WHERE id = v_equip_id;

      INSERT INTO public.order_automation_log (order_id, action, entity_type, entity_id, details)
      VALUES (NEW.id, 'equipment_reserved', 'equipment_inventory', v_equip_id,
        jsonb_build_object('category', 'terminal'));
    END IF;
  END IF;

  IF v_needs_sim THEN
    SELECT id INTO v_equip_id FROM public.equipment_inventory
    WHERE category = 'sim' AND status = 'in_stock' AND order_id IS NULL
    ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;

    IF v_equip_id IS NOT NULL THEN
      UPDATE public.equipment_inventory
      SET status = 'reserved', order_id = NEW.id, account_id = v_account_id,
          address_id = v_address_id, assigned_at = now(), updated_at = now()
      WHERE id = v_equip_id;

      INSERT INTO public.order_automation_log (order_id, action, entity_type, entity_id, details)
      VALUES (NEW.id, 'equipment_reserved', 'equipment_inventory', v_equip_id,
        jsonb_build_object('category', 'sim'));
    END IF;
  END IF;

  -- ═══ STEP 4: Create installation job if needed (idempotent) ═══
  IF NEW.installation_type IS NOT NULL AND NEW.installation_type NOT IN ('auto', 'self', 'auto-installation') THEN
    SELECT id INTO v_job_id FROM public.installation_jobs WHERE order_id = NEW.id LIMIT 1;

    IF v_job_id IS NULL THEN
      INSERT INTO public.installation_jobs (
        order_id, account_id, address_id, job_type, status,
        service_type, service_address, service_city, service_postal_code,
        client_name, client_email, client_phone
      )
      VALUES (
        NEW.id, v_account_id, v_address_id, 'installation', 'pending',
        v_service_type,
        NEW.shipping_address, NEW.shipping_city, NEW.shipping_postal_code,
        COALESCE(NEW.client_first_name || ' ' || NEW.client_last_name, ''),
        NEW.client_email, NEW.client_phone
      )
      RETURNING id INTO v_job_id;

      INSERT INTO public.order_automation_log (order_id, action, entity_type, entity_id, details)
      VALUES (NEW.id, 'installation_job_created', 'installation_job', v_job_id,
        jsonb_build_object('service_type', v_service_type, 'installation_type', NEW.installation_type));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Attach trigger to orders table
DROP TRIGGER IF EXISTS trg_automate_order_confirmed ON public.orders;
CREATE TRIGGER trg_automate_order_confirmed
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_automate_order_confirmed();
