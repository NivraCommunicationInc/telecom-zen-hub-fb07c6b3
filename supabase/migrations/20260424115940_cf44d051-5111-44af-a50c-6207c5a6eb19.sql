-- ============================================================
-- FIX 1: field_quotes table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.field_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  agent_name TEXT,
  client_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  equipment JSONB NOT NULL DEFAULT '[]'::jsonb,
  discount JSONB,
  activation_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tps NUMERIC(10,2) NOT NULL DEFAULT 0,
  tvq NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  valid_until TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  email_sent_at TIMESTAMPTZ,
  converted_order_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_field_quotes_agent ON public.field_quotes(agent_id);
CREATE INDEX IF NOT EXISTS idx_field_quotes_status ON public.field_quotes(status);
CREATE INDEX IF NOT EXISTS idx_field_quotes_valid_until ON public.field_quotes(valid_until);

ALTER TABLE public.field_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Field agent can read own quotes" ON public.field_quotes;
CREATE POLICY "Field agent can read own quotes"
  ON public.field_quotes FOR SELECT TO authenticated
  USING (
    agent_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
  );

DROP POLICY IF EXISTS "Field agent can insert own quotes" ON public.field_quotes;
CREATE POLICY "Field agent can insert own quotes"
  ON public.field_quotes FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid());

DROP POLICY IF EXISTS "Field agent can update own quotes" ON public.field_quotes;
CREATE POLICY "Field agent can update own quotes"
  ON public.field_quotes FOR UPDATE TO authenticated
  USING (
    agent_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
  );

DROP TRIGGER IF EXISTS trg_field_quotes_updated_at ON public.field_quotes;
CREATE TRIGGER trg_field_quotes_updated_at
  BEFORE UPDATE ON public.field_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- FIX 2: extend agent_discounts catalogue
-- ============================================================
ALTER TABLE public.agent_discounts
  ADD COLUMN IF NOT EXISTS duration_months INTEGER,
  ADD COLUMN IF NOT EXISTS min_plan_price NUMERIC(10,2);

-- Relax existing constraints to support the 6 new types/applies_to values
ALTER TABLE public.agent_discounts DROP CONSTRAINT IF EXISTS agent_discounts_applies_to_check;
ALTER TABLE public.agent_discounts ADD CONSTRAINT agent_discounts_applies_to_check
  CHECK (applies_to = ANY (ARRAY[
    'internet','tv','mobile','bundle','all',
    'installation','plans_80_plus','plans_90_plus','plan_only'
  ]));

ALTER TABLE public.agent_discounts DROP CONSTRAINT IF EXISTS agent_discounts_type_check;
ALTER TABLE public.agent_discounts ADD CONSTRAINT agent_discounts_type_check
  CHECK (type = ANY (ARRAY[
    'fixed','percentage','fixed_monthly','remove_fee','first_month_free'
  ]));

ALTER TABLE public.agent_discounts DROP CONSTRAINT IF EXISTS agent_discounts_value_check;
ALTER TABLE public.agent_discounts ADD CONSTRAINT agent_discounts_value_check
  CHECK (value >= 0);

-- Insert the 6 canonical Nivra Field discounts
INSERT INTO public.agent_discounts (name, description, type, value, applies_to, duration_months, min_plan_price, is_active)
VALUES
  ('Installation gratuite',
   'Supprime les frais d''installation',
   'remove_fee', 0, 'installation', NULL, NULL, true),

  ('Rabais 5$/mois — 12 mois',
   '5 $ de rabais mensuel pendant 12 mois',
   'fixed_monthly', 5.00, 'all', 12, NULL, true),

  ('Rabais 10$/mois — 6 mois',
   '10 $ de rabais mensuel pendant 6 mois',
   'fixed_monthly', 10.00, 'all', 6, NULL, true),

  ('Rabais 10$/mois — 12 mois',
   'Uniquement forfaits 80 $ et plus — 10 $/mois pendant 12 mois',
   'fixed_monthly', 10.00, 'plans_80_plus', 12, 80.00, true),

  ('Rabais 25$/mois — 12 mois',
   'Uniquement forfaits 90 $ et plus — 25 $/mois pendant 12 mois',
   'fixed_monthly', 25.00, 'plans_90_plus', 12, 90.00, true),

  ('Premier mois gratuit',
   '100% rabais sur le premier mois du forfait uniquement. Ne s''applique pas sur l''équipement ni les frais d''activation.',
   'first_month_free', 100.00, 'plan_only', 1, NULL, true)
ON CONFLICT DO NOTHING;

-- Assign each of the 6 to role=field_sales
INSERT INTO public.agent_discount_assignments (discount_id, role, applies_to_all)
SELECT d.id, 'field_sales', false
FROM public.agent_discounts d
WHERE d.name IN (
  'Installation gratuite',
  'Rabais 5$/mois — 12 mois',
  'Rabais 10$/mois — 6 mois',
  'Rabais 10$/mois — 12 mois',
  'Rabais 25$/mois — 12 mois',
  'Premier mois gratuit'
)
AND NOT EXISTS (
  SELECT 1 FROM public.agent_discount_assignments a
  WHERE a.discount_id = d.id AND a.role = 'field_sales'
);