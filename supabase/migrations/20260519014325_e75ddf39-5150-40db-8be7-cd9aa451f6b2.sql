
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS crm_contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_crm_contact_id ON public.orders(crm_contact_id) WHERE crm_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_source_crm ON public.orders(source) WHERE source = 'crm_call';

INSERT INTO public.commission_rules (role, applies_to, percentage, is_active, effective_from, notes)
SELECT 'employee', 'internet',  30.0, true, CURRENT_DATE, 'CRM CS — 30% forfait Internet/TV mensuel'
WHERE NOT EXISTS (SELECT 1 FROM public.commission_rules WHERE role='employee' AND applies_to='internet' AND is_active);

INSERT INTO public.commission_rules (role, applies_to, percentage, is_active, effective_from, notes)
SELECT 'employee', 'tv',        30.0, true, CURRENT_DATE, 'CRM CS — 30% forfait TV mensuel'
WHERE NOT EXISTS (SELECT 1 FROM public.commission_rules WHERE role='employee' AND applies_to='tv' AND is_active);

INSERT INTO public.commission_rules (role, applies_to, percentage, is_active, effective_from, notes)
SELECT 'employee', 'bundle',    30.0, true, CURRENT_DATE, 'CRM CS — 30% bundle mensuel'
WHERE NOT EXISTS (SELECT 1 FROM public.commission_rules WHERE role='employee' AND applies_to='bundle' AND is_active);

INSERT INTO public.commission_rules (role, applies_to, percentage, is_active, effective_from, notes)
SELECT 'employee', 'equipment', 5.0, true, CURRENT_DATE, 'CRM CS — 5% équipement'
WHERE NOT EXISTS (SELECT 1 FROM public.commission_rules WHERE role='employee' AND applies_to='equipment' AND is_active);

INSERT INTO public.commission_rules (role, applies_to, percentage, is_active, effective_from, notes)
SELECT 'employee', 'mobile',    0.0, true, CURRENT_DATE, 'CRM CS — 0% mobile'
WHERE NOT EXISTS (SELECT 1 FROM public.commission_rules WHERE role='employee' AND applies_to='mobile' AND is_active);

CREATE OR REPLACE FUNCTION public.fn_create_cs_commission_on_crm_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_agent_id   uuid;
  v_base       numeric;
  v_rate       numeric := 0.30;
  v_amount     numeric;
  v_existing   uuid;
BEGIN
  IF NEW.source IS DISTINCT FROM 'crm_call' THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_agent_id := COALESCE(NEW.created_by_agent_id, NULLIF(NEW.created_by, '')::uuid);
  EXCEPTION WHEN OTHERS THEN
    v_agent_id := NEW.created_by_agent_id;
  END;

  IF v_agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_existing
    FROM public.sales_commissions
   WHERE converted_order_id = NEW.id
   LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_base := COALESCE(NEW.subtotal, NEW.total_amount, 0);
  IF v_base <= 0 THEN
    RETURN NEW;
  END IF;

  v_amount := ROUND((v_base * v_rate)::numeric, 2);

  INSERT INTO public.sales_commissions (
    salesperson_id, converted_order_id, sale_amount,
    commission_rate, commission_amount, status, notes, created_at, updated_at
  ) VALUES (
    v_agent_id, NEW.id, v_base,
    v_rate, v_amount, 'pending',
    'Commission CRM — vente OneView CS',
    now(), now()
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cs_commission_on_crm_sale ON public.orders;
CREATE TRIGGER trg_cs_commission_on_crm_sale
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_create_cs_commission_on_crm_sale();
