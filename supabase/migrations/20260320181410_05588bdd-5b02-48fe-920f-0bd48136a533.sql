
-- Commission withdrawal requests table
CREATE TABLE IF NOT EXISTS public.commission_withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected', 'cancelled')),
  notes TEXT,
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commission_withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Agents can see their own requests
CREATE POLICY "agents_view_own_withdrawals" ON public.commission_withdrawal_requests
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

-- Agents can insert their own requests
CREATE POLICY "agents_create_own_withdrawals" ON public.commission_withdrawal_requests
  FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid());

-- Admins can view all
CREATE POLICY "admins_view_all_withdrawals" ON public.commission_withdrawal_requests
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update (approve/reject/pay)
CREATE POLICY "admins_update_withdrawals" ON public.commission_withdrawal_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Field sales approved promotions table
CREATE TABLE IF NOT EXISTS public.field_sales_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  promo_type TEXT NOT NULL CHECK (promo_type IN ('monthly_discount', 'free_installation', 'activation_credit', 'percentage_off', 'custom')),
  discount_monthly NUMERIC(10,2) DEFAULT 0,
  discount_onetime NUMERIC(10,2) DEFAULT 0,
  discount_percentage NUMERIC(5,2) DEFAULT 0,
  duration_months INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.field_sales_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_field_promos" ON public.field_sales_promotions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admins_manage_field_promos" ON public.field_sales_promotions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed default promotions
INSERT INTO public.field_sales_promotions (name, description, promo_type, discount_monthly, duration_months) VALUES
  ('5$/mois x 12 mois', 'Réduction de 5$/mois pendant 12 mois', 'monthly_discount', 5.00, 12);
INSERT INTO public.field_sales_promotions (name, description, promo_type, discount_onetime) VALUES
  ('Installation gratuite', 'Frais d''installation crédités', 'free_installation', 50.00);
INSERT INTO public.field_sales_promotions (name, description, promo_type, discount_onetime) VALUES
  ('Activation créditée', 'Frais d''activation crédités', 'activation_credit', 25.00);
