-- ============================================================================
-- 1) ACCOUNTS — chargeback tracking columns
-- ============================================================================
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS has_active_chargeback boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chargeback_opened_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS chargeback_resolved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS chargeback_last_interest_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS chargeback_reactivation_fee_applied_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_accounts_active_chargeback
  ON public.accounts(has_active_chargeback)
  WHERE has_active_chargeback = true;

-- ============================================================================
-- 2) COMMISSIONS — auto-create on order activation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_auto_create_commission_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id        uuid;
  v_rule_pct        numeric;
  v_default_pct     numeric := 5.0;
  v_pct             numeric;
  v_base            numeric;
  v_amount          numeric;
  v_existing_id     uuid;
  v_service_type    text;
BEGIN
  -- Only fire when status transitions INTO activated/completed
  IF NEW.status IS NULL OR NEW.status NOT IN ('activated','completed') THEN
    RETURN NEW;
  END IF;
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Resolve agent: orders.created_by stores a uuid as text in the legacy schema
  BEGIN
    v_agent_id := NEW.created_by::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_agent_id := NULL;
  END;

  -- Fallback: link via field_sales_orders.salesperson_id if available
  IF v_agent_id IS NULL THEN
    SELECT fso.salesperson_id
      INTO v_agent_id
      FROM public.field_sales_orders fso
     WHERE fso.converted_order_id = NEW.id
     LIMIT 1;
  END IF;

  IF v_agent_id IS NULL THEN
    RETURN NEW;  -- no agent, nothing to do
  END IF;

  -- Idempotency: skip if a commission already exists for this order (any status)
  SELECT id INTO v_existing_id
    FROM public.sales_commissions
   WHERE converted_order_id = NEW.id
   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_service_type := COALESCE(NEW.service_type, 'all');
  v_base := COALESCE(NEW.subtotal, NEW.total_amount, 0);

  IF v_base <= 0 THEN
    RETURN NEW;
  END IF;

  -- Find best matching active rule (highest percentage wins)
  SELECT MAX(percentage)
    INTO v_rule_pct
    FROM public.commission_rules
   WHERE is_active = true
     AND (employee_id = v_agent_id OR employee_id IS NULL)
     AND (applies_to = v_service_type OR applies_to = 'all')
     AND (effective_from <= CURRENT_DATE)
     AND (effective_until IS NULL OR effective_until >= CURRENT_DATE);

  v_pct := COALESCE(v_rule_pct, v_default_pct);
  v_amount := ROUND((v_base * v_pct / 100.0)::numeric, 2);

  INSERT INTO public.sales_commissions (
    salesperson_id, converted_order_id, sale_amount,
    commission_rate, commission_amount, status, notes, created_at, updated_at
  ) VALUES (
    v_agent_id, NEW.id, v_base,
    v_pct, v_amount, 'pending',
    CASE WHEN v_rule_pct IS NULL
         THEN format('Auto — taux par défaut %s%% (aucune règle)', v_default_pct)
         ELSE format('Auto — règle %s%% (%s)', v_pct, v_service_type)
    END,
    now(), now()
  );

  INSERT INTO public.activity_logs (
    user_id, action, entity_type, entity_id, details, created_at
  ) VALUES (
    v_agent_id, 'commission_auto_created', 'order', NEW.id,
    jsonb_build_object(
      'order_number', NEW.order_number,
      'amount', v_amount,
      'rate', v_pct,
      'base', v_base,
      'service_type', v_service_type,
      'rule_matched', v_rule_pct IS NOT NULL
    ),
    now()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_commission ON public.orders;
CREATE TRIGGER trg_auto_create_commission
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_create_commission_on_order();

-- ============================================================================
-- 3) COMMISSIONS — auto-clawback on order cancellation/refund
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_auto_clawback_commission_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF NEW.status IS NULL OR NEW.status NOT IN ('cancelled','refunded') THEN
    RETURN NEW;
  END IF;
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  WITH upd AS (
    UPDATE public.sales_commissions
       SET status = 'clawback',
           notes = COALESCE(notes,'') || E'\n[' || to_char(now(),'YYYY-MM-DD HH24:MI') || '] '
                   || 'Commande ' || COALESCE(NEW.order_number, NEW.id::text)
                   || ' ' || NEW.status || ' — Commission récupérée automatiquement.',
           updated_at = now()
     WHERE converted_order_id = NEW.id
       AND status = 'pending'
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM upd;

  IF v_count > 0 THEN
    INSERT INTO public.activity_logs (
      user_id, action, entity_type, entity_id, details, created_at
    ) VALUES (
      NULL, 'commission_auto_clawback', 'order', NEW.id,
      jsonb_build_object(
        'order_number', NEW.order_number,
        'order_status', NEW.status,
        'clawback_count', v_count
      ),
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_clawback_commission ON public.orders;
CREATE TRIGGER trg_auto_clawback_commission
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_clawback_commission_on_order();
