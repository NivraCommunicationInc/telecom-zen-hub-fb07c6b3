-- Territory & Streets tracking for field agents
CREATE TABLE public.field_territory_streets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  street_name TEXT NOT NULL,
  city TEXT DEFAULT 'Montréal',
  postal_code TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed')),
  total_doors INT DEFAULT 0,
  doors_knocked INT DEFAULT 0,
  doors_answered INT DEFAULT 0,
  doors_sold INT DEFAULT 0,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.field_territory_streets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own streets"
  ON public.field_territory_streets FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert own streets"
  ON public.field_territory_streets FOR INSERT
  TO authenticated
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own streets"
  ON public.field_territory_streets FOR UPDATE
  TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Agents can delete own streets"
  ON public.field_territory_streets FOR DELETE
  TO authenticated
  USING (agent_id = auth.uid());

-- Field agent discounts (up to $50 for up to 24 months)
CREATE TABLE public.field_agent_discounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  field_order_id UUID REFERENCES public.field_sales_orders(id),
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_months INT NOT NULL DEFAULT 1,
  applied_per_bill BOOLEAN NOT NULL DEFAULT true,
  customer_name TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger: max $50, max 24 months
CREATE OR REPLACE FUNCTION public.validate_field_agent_discount()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.discount_amount > 50 THEN
    RAISE EXCEPTION 'Field agent discount cannot exceed $50';
  END IF;
  IF NEW.duration_months > 24 THEN
    RAISE EXCEPTION 'Field agent discount duration cannot exceed 24 months';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_field_agent_discount
  BEFORE INSERT OR UPDATE ON public.field_agent_discounts
  FOR EACH ROW EXECUTE FUNCTION public.validate_field_agent_discount();

ALTER TABLE public.field_agent_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own discounts"
  ON public.field_agent_discounts FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert own discounts"
  ON public.field_agent_discounts FOR INSERT
  TO authenticated
  WITH CHECK (agent_id = auth.uid());