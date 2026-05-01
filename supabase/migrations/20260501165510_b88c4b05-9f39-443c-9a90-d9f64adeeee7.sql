
-- ============================================================
-- 0) WIDEN commission_rules.applies_to to allow 'equipment'
-- ============================================================
ALTER TABLE public.commission_rules
  DROP CONSTRAINT IF EXISTS commission_rules_applies_to_check;

ALTER TABLE public.commission_rules
  ADD CONSTRAINT commission_rules_applies_to_check
  CHECK (applies_to = ANY (ARRAY[
    'internet','mobile','tv','bundle','phone','equipment','all'
  ]));

-- ============================================================
-- 1) FIELD BONUS RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.field_bonus_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_sales INTEGER NOT NULL,
  max_sales INTEGER,
  bonus_amount NUMERIC(10,2) NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.field_bonus_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated employees can view bonus rules" ON public.field_bonus_rules;
CREATE POLICY "Authenticated employees can view bonus rules"
  ON public.field_bonus_rules FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
    OR public.has_role(auth.uid(), 'field_sales')
  );

DROP POLICY IF EXISTS "Admins manage bonus rules" ON public.field_bonus_rules;
CREATE POLICY "Admins manage bonus rules"
  ON public.field_bonus_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DELETE FROM public.field_bonus_rules WHERE period = 'monthly';
INSERT INTO public.field_bonus_rules (min_sales, max_sales, bonus_amount, period) VALUES
  (10, 19,   100.00, 'monthly'),
  (20, 29,   250.00, 'monthly'),
  (30, 49,   450.00, 'monthly'),
  (50, NULL, 750.00, 'monthly');

-- ============================================================
-- 2) COMMISSION RULES — reset to canonical grid
-- ============================================================
DELETE FROM public.commission_rules WHERE role = 'field_sales';

INSERT INTO public.commission_rules
  (role, applies_to, percentage, min_monthly, is_active, effective_from, notes)
VALUES
  ('field_sales', 'internet',  30.00, 0, true, CURRENT_DATE, 'Internet 30%'),
  ('field_sales', 'tv',        30.00, 0, true, CURRENT_DATE, 'TV 30%'),
  ('field_sales', 'bundle',    30.00, 0, true, CURRENT_DATE, 'Bundle 30%'),
  ('field_sales', 'equipment',  5.00, 0, true, CURRENT_DATE, 'Equipement 5%');

-- ============================================================
-- 3) FIELD COMMISSIONS — extend schema
-- ============================================================
ALTER TABLE public.field_commissions
  ADD COLUMN IF NOT EXISTS commission_type TEXT NOT NULL DEFAULT 'sale',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS earned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clawback_eligible_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clawback_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS ux_field_commissions_order_sale
  ON public.field_commissions (order_id, commission_type)
  WHERE order_id IS NOT NULL;

-- ============================================================
-- 4) COMMISSION CALCULATION FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_calculate_field_commission(
  p_order_id UUID,
  p_agent_id UUID
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_commission NUMERIC := 0;
  v_item RECORD;
BEGIN
  FOR v_item IN
    SELECT oi.unit_price, oi.quantity, oi.service_type::text AS stype
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
      AND oi.service_type::text <> 'mobile'
  LOOP
    IF v_item.stype IN ('internet','tv','bundle') THEN
      v_commission := v_commission + (COALESCE(v_item.unit_price, 0) * 0.30);
    ELSIF v_item.stype = 'equipment' THEN
      v_commission := v_commission +
        (COALESCE(v_item.unit_price, 0) * 0.05 * COALESCE(v_item.quantity, 1));
    END IF;
  END LOOP;

  RETURN ROUND(v_commission, 2);
END;
$$;

-- ============================================================
-- 5) TRIGGER — create commission on order activation
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_create_commission_on_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id UUID;
  v_commission NUMERIC;
BEGIN
  IF NEW.status = 'activated'
     AND (OLD.status IS DISTINCT FROM 'activated') THEN

    v_agent_id := NEW.created_by_agent_id;

    IF v_agent_id IS NOT NULL
       AND public.has_role(v_agent_id, 'field_sales') THEN

      v_commission := public.fn_calculate_field_commission(NEW.id, v_agent_id);

      IF v_commission > 0 THEN
        INSERT INTO public.field_commissions (
          agent_id, order_id, amount, status,
          commission_type, description,
          earned_at, clawback_eligible_until
        ) VALUES (
          v_agent_id, NEW.id, v_commission, 'pending',
          'sale',
          'Commission vente #' || COALESCE(NEW.order_number, NEW.id::text),
          now(), now() + INTERVAL '30 days'
        )
        ON CONFLICT (order_id, commission_type) DO NOTHING;

        INSERT INTO public.employee_notifications (
          user_id, notification_type, title, message, work_item_id, is_read
        ) VALUES (
          v_agent_id, 'system',
          'Nouvelle commission — ' || v_commission::text || ' $',
          'Votre commission de ' || v_commission::text ||
            ' $ pour la commande #' || COALESCE(NEW.order_number, NEW.id::text) ||
            ' est en attente de confirmation.',
          NEW.id, false
        );
      END IF;
    END IF;
  END IF;

  IF NEW.status = 'completed' AND OLD.status = 'activated' THEN
    UPDATE public.field_commissions
       SET status = 'approved', approved_at = now()
     WHERE order_id = NEW.id AND status = 'pending';
  END IF;

  IF NEW.status = 'cancelled' THEN
    UPDATE public.field_commissions
       SET status = 'clawback',
           clawback_reason = 'Commande annulée',
           clawback_at = now()
     WHERE order_id = NEW.id
       AND status IN ('pending','approved')
       AND (clawback_eligible_until IS NULL OR clawback_eligible_until >= now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commission_on_activation ON public.orders;
CREATE TRIGGER trg_commission_on_activation
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_create_commission_on_activation();

-- ============================================================
-- 6) ACCOUNT ADJUSTMENTS — manual credits / fees
-- ============================================================
CREATE TABLE IF NOT EXISTS public.account_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit','fee')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  months_total INTEGER NOT NULL DEFAULT 1 CHECK (months_total >= 1),
  months_remaining INTEGER NOT NULL CHECK (months_remaining >= 0),
  applied_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','cancelled')),
  created_by UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_applied_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_account_adjustments_account_active
  ON public.account_adjustments (account_id, status)
  WHERE status = 'active';

ALTER TABLE public.account_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view account adjustments" ON public.account_adjustments;
CREATE POLICY "Staff can view account adjustments"
  ON public.account_adjustments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
  );

DROP POLICY IF EXISTS "Staff can insert account adjustments" ON public.account_adjustments;
CREATE POLICY "Staff can insert account adjustments"
  ON public.account_adjustments FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
  );

DROP POLICY IF EXISTS "Admins can update account adjustments" ON public.account_adjustments;
CREATE POLICY "Admins can update account adjustments"
  ON public.account_adjustments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
