-- =========================================================================
-- FIX MULTI-ADRESSES : propagation service_address_id + backfill global
-- =========================================================================
-- 1) Corrige le trigger fn_automate_order_confirmed pour utiliser
--    service_address_id (canonique) et le propager à subscriptions,
--    equipment_inventory et installation_jobs.
-- 2) Backfill : pour toutes les commandes ayant un service_address_id,
--    propage l'adresse aux tables aval quand elle est NULL.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.fn_automate_order_confirmed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_sub_id uuid;
  v_equip_id uuid;
  v_job_id uuid;
  v_service_type text;
  v_plan_name text;
  v_monthly_price numeric;
  v_subscription_amount numeric;
  v_account_id uuid;
  v_needs_router boolean := false;
  v_needs_terminal boolean := false;
  v_needs_sim boolean := false;
  v_address_id uuid;
  v_is_digital_only boolean := false;
BEGIN
  IF NEW.status <> 'confirmed' OR (OLD.status IS NOT NULL AND OLD.status = 'confirmed') THEN
    RETURN NEW;
  END IF;

  v_service_type := NULLIF(trim(COALESCE(NEW.service_type, '')), '');
  v_account_id := NEW.account_id;
  v_subscription_amount := COALESCE(NEW.total_amount, NEW.subtotal, NEW.snapshot_total, 0);
  v_monthly_price := COALESCE(NEW.subtotal, NEW.total_amount, NEW.snapshot_total, 0);
  -- FIX: prefer canonical service_address_id, fallback to legacy service_location_id
  v_address_id := COALESCE(NEW.service_address_id, NEW.service_location_id);

  v_plan_name := COALESCE(NULLIF(initcap(replace(COALESCE(v_service_type, ''), '_', ' ')), ''), 'Service Numérique');

  v_is_digital_only :=
    COALESCE(NEW.fulfillment_type, '') = 'digital'
    OR lower(COALESCE(NEW.delivery_method, '')) LIKE '%numérique%'
    OR lower(COALESCE(v_service_type, '')) LIKE '%streaming%';

  SELECT id INTO v_sub_id FROM public.subscriptions WHERE order_id = NEW.id LIMIT 1;

  IF v_sub_id IS NULL THEN
    INSERT INTO public.subscriptions (
      account_id,
      order_id,
      user_id,
      service_type,
      plan_name,
      status,
      amount,
      monthly_price,
      billing_cycle,
      start_date,
      next_billing_date,
      subscription_number,
      service_address_id  -- FIX: propagate canonical address
    )
    VALUES (
      v_account_id,
      NEW.id,
      NEW.user_id,
      COALESCE(v_service_type, 'streaming_plus'),
      v_plan_name,
      'active',
      v_subscription_amount,
      v_monthly_price,
      'monthly',
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '30 days',
      'SUB-' || lpad(nextval('subscription_number_seq')::text, 6, '0'),
      v_address_id
    )
    RETURNING id INTO v_sub_id;

    INSERT INTO public.order_automation_log (order_id, action, entity_type, entity_id, details)
    VALUES (
      NEW.id,
      'subscription_created',
      'subscription',
      v_sub_id,
      jsonb_build_object(
        'service_type', COALESCE(v_service_type, 'streaming_plus'),
        'plan_name', v_plan_name,
        'amount', v_subscription_amount,
        'monthly_price', v_monthly_price,
        'digital_only', v_is_digital_only,
        'service_address_id', v_address_id
      )
    );
  ELSE
    -- Ensure existing subscription gets the address if missing
    UPDATE public.subscriptions
    SET service_address_id = COALESCE(service_address_id, v_address_id),
        updated_at = now()
    WHERE id = v_sub_id AND service_address_id IS NULL AND v_address_id IS NOT NULL;
  END IF;

  IF NOT v_is_digital_only THEN
    IF v_service_type IN ('internet', 'combo', 'internet_tv', 'internet_mobile', 'internet_tv_mobile') THEN
      v_needs_router := true;
    END IF;
    IF v_service_type IN ('tv', 'combo', 'internet_tv', 'internet_tv_mobile', 'television') THEN
      v_needs_terminal := true;
    END IF;
    IF v_service_type IN ('mobile', 'internet_mobile', 'internet_tv_mobile') THEN
      v_needs_sim := true;
    END IF;

    IF v_needs_router THEN
      SELECT id INTO v_equip_id FROM public.equipment_inventory
      WHERE category = 'router' AND status = 'in_stock' AND order_id IS NULL
      ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;

      IF v_equip_id IS NOT NULL THEN
        UPDATE public.equipment_inventory
        SET status = 'reserved', order_id = NEW.id, account_id = v_account_id,
            address_id = v_address_id,
            service_address_id = v_address_id,  -- FIX: propagate canonical
            assigned_at = now(), updated_at = now()
        WHERE id = v_equip_id;

        INSERT INTO public.order_automation_log (order_id, action, entity_type, entity_id, details)
        VALUES (NEW.id, 'equipment_reserved', 'equipment_inventory', v_equip_id,
          jsonb_build_object('category', 'router', 'service_address_id', v_address_id));
      END IF;
    END IF;

    IF v_needs_terminal THEN
      SELECT id INTO v_equip_id FROM public.equipment_inventory
      WHERE category = 'terminal' AND status = 'in_stock' AND order_id IS NULL
      ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;

      IF v_equip_id IS NOT NULL THEN
        UPDATE public.equipment_inventory
        SET status = 'reserved', order_id = NEW.id, account_id = v_account_id,
            address_id = v_address_id,
            service_address_id = v_address_id,
            assigned_at = now(), updated_at = now()
        WHERE id = v_equip_id;

        INSERT INTO public.order_automation_log (order_id, action, entity_type, entity_id, details)
        VALUES (NEW.id, 'equipment_reserved', 'equipment_inventory', v_equip_id,
          jsonb_build_object('category', 'terminal', 'service_address_id', v_address_id));
      END IF;
    END IF;

    IF v_needs_sim THEN
      SELECT id INTO v_equip_id FROM public.equipment_inventory
      WHERE category = 'sim' AND status = 'in_stock' AND order_id IS NULL
      ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;

      IF v_equip_id IS NOT NULL THEN
        UPDATE public.equipment_inventory
        SET status = 'reserved', order_id = NEW.id, account_id = v_account_id,
            address_id = v_address_id,
            service_address_id = v_address_id,
            assigned_at = now(), updated_at = now()
        WHERE id = v_equip_id;

        INSERT INTO public.order_automation_log (order_id, action, entity_type, entity_id, details)
        VALUES (NEW.id, 'equipment_reserved', 'equipment_inventory', v_equip_id,
          jsonb_build_object('category', 'sim', 'service_address_id', v_address_id));
      END IF;
    END IF;

    IF NEW.installation_type IS NOT NULL AND NEW.installation_type NOT IN ('auto', 'self', 'auto-installation') THEN
      SELECT id INTO v_job_id FROM public.installation_jobs WHERE order_id = NEW.id LIMIT 1;

      IF v_job_id IS NULL THEN
        INSERT INTO public.installation_jobs (
          order_id, account_id, address_id, service_address_id, job_type, status,
          service_type, service_address, service_city, service_postal_code,
          client_name, client_email, client_phone
        )
        VALUES (
          NEW.id, v_account_id, v_address_id, v_address_id, 'installation', 'pending',
          COALESCE(v_service_type, 'service'),
          NEW.shipping_address, NEW.shipping_city, NEW.shipping_postal_code,
          COALESCE(NEW.client_first_name || ' ' || NEW.client_last_name, ''),
          NEW.client_email, NEW.client_phone
        )
        RETURNING id INTO v_job_id;

        INSERT INTO public.order_automation_log (order_id, action, entity_type, entity_id, details)
        VALUES (NEW.id, 'installation_job_created', 'installation_job', v_job_id,
          jsonb_build_object('service_type', COALESCE(v_service_type, 'service'),
                             'installation_type', NEW.installation_type,
                             'service_address_id', v_address_id));
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- =========================================================================
-- BACKFILL GLOBAL — tous les comptes
-- =========================================================================

-- 1) subscriptions : hériter service_address_id depuis orders
UPDATE public.subscriptions s
SET service_address_id = o.service_address_id,
    updated_at = now()
FROM public.orders o
WHERE s.order_id = o.id
  AND s.service_address_id IS NULL
  AND o.service_address_id IS NOT NULL;

-- 2) equipment_inventory : hériter depuis orders (via order_id)
UPDATE public.equipment_inventory ei
SET service_address_id = o.service_address_id,
    address_id = COALESCE(ei.address_id, o.service_address_id),
    updated_at = now()
FROM public.orders o
WHERE ei.order_id = o.id
  AND ei.service_address_id IS NULL
  AND o.service_address_id IS NOT NULL;

-- 3) equipment_inventory : hériter depuis subscription si toujours NULL
UPDATE public.equipment_inventory ei
SET service_address_id = s.service_address_id,
    address_id = COALESCE(ei.address_id, s.service_address_id),
    updated_at = now()
FROM public.subscriptions s
WHERE ei.subscription_id = s.id
  AND ei.service_address_id IS NULL
  AND s.service_address_id IS NOT NULL;

-- 4) equipment_inventory : fallback sur l'adresse par défaut du compte
UPDATE public.equipment_inventory ei
SET service_address_id = sa.id,
    address_id = COALESCE(ei.address_id, sa.id),
    updated_at = now()
FROM public.service_addresses sa
WHERE ei.account_id = sa.account_id
  AND ei.service_address_id IS NULL
  AND sa.is_default = true
  AND sa.is_active = true
  AND sa.deleted_at IS NULL;

-- 5) installation_jobs : hériter depuis orders
UPDATE public.installation_jobs ij
SET service_address_id = o.service_address_id,
    address_id = COALESCE(ij.address_id, o.service_address_id)
FROM public.orders o
WHERE ij.order_id = o.id
  AND ij.service_address_id IS NULL
  AND o.service_address_id IS NOT NULL;

-- 6) service_addresses.is_default : garantir qu'un compte avec 1+ adresses
--    en a exactement une par défaut (sinon les fallbacks futurs échouent)
WITH accounts_missing_default AS (
  SELECT sa.account_id
  FROM public.service_addresses sa
  WHERE sa.is_active = true AND sa.deleted_at IS NULL
  GROUP BY sa.account_id
  HAVING bool_or(sa.is_default) = false
),
first_addr AS (
  SELECT DISTINCT ON (sa.account_id) sa.account_id, sa.id
  FROM public.service_addresses sa
  JOIN accounts_missing_default a ON a.account_id = sa.account_id
  WHERE sa.is_active = true AND sa.deleted_at IS NULL
  ORDER BY sa.account_id, sa.created_at ASC
)
UPDATE public.service_addresses sa
SET is_default = true, updated_at = now()
FROM first_addr fa
WHERE sa.id = fa.id;