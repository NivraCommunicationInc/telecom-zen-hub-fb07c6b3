
-- Quote status enum
CREATE TYPE public.quote_status AS ENUM (
  'draft', 'pending_review', 'approved', 'sent', 'viewed',
  'accepted', 'rejected', 'expired', 'converted'
);

-- Quote line type enum
CREATE TYPE public.quote_line_type AS ENUM (
  'catalog_service', 'manual_fee', 'activation_fee',
  'shipping_fee', 'promo_discount', 'credit'
);

-- Quote billing frequency enum
CREATE TYPE public.quote_billing_frequency AS ENUM ('one_time', 'monthly');

-- Quote adjustment type enum
CREATE TYPE public.quote_adjustment_type AS ENUM ('discount', 'credit');

-- Quote adjustment source enum
CREATE TYPE public.quote_adjustment_source AS ENUM (
  'employee_proposed', 'admin_approved', 'system'
);

-- Quote approval status enum
CREATE TYPE public.quote_approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Quote approval decision enum
CREATE TYPE public.quote_approval_decision AS ENUM ('approved', 'rejected');

-- 1. QUOTES
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT NOT NULL UNIQUE,
  customer_user_id UUID NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  status public.quote_status NOT NULL DEFAULT 'draft',
  source_portal TEXT NOT NULL CHECK (source_portal IN ('employee', 'core')),
  created_by_user_id UUID NOT NULL,
  assigned_to_user_id UUID,
  valid_until TIMESTAMPTZ,
  currency TEXT NOT NULL DEFAULT 'CAD',
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  discounts_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  credits_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  taxes_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_due_now NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  client_note TEXT,
  internal_note TEXT,
  approved_by_user_id UUID,
  approved_at TIMESTAMPTZ,
  converted_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. QUOTE_LINES
CREATE TABLE public.quote_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  service_id UUID,
  line_type public.quote_line_type NOT NULL DEFAULT 'catalog_service',
  label TEXT NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  billing_frequency public.quote_billing_frequency NOT NULL DEFAULT 'monthly',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. QUOTE_ADJUSTMENTS
CREATE TABLE public.quote_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  adjustment_type public.quote_adjustment_type NOT NULL,
  label TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  source public.quote_adjustment_source NOT NULL DEFAULT 'employee_proposed',
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  approval_status public.quote_approval_status NOT NULL DEFAULT 'pending',
  created_by_user_id UUID NOT NULL,
  approved_by_user_id UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. QUOTE_EVENTS
CREATE TABLE public.quote_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_user_id UUID,
  actor_role TEXT NOT NULL DEFAULT 'system',
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. QUOTE_APPROVALS
CREATE TABLE public.quote_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  decision public.quote_approval_decision NOT NULL,
  reason TEXT,
  actor_user_id UUID NOT NULL,
  actor_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_approvals ENABLE ROW LEVEL SECURITY;

-- RLS policies: admin and employee can manage quotes
CREATE POLICY "Admin full access on quotes"
  ON public.quotes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employee full access on quotes"
  ON public.quotes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'employee'))
  WITH CHECK (public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Supervisor full access on quotes"
  ON public.quotes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

-- quote_lines
CREATE POLICY "Admin full access on quote_lines"
  ON public.quote_lines FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employee full access on quote_lines"
  ON public.quote_lines FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'employee'))
  WITH CHECK (public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Supervisor full access on quote_lines"
  ON public.quote_lines FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

-- quote_adjustments
CREATE POLICY "Admin full access on quote_adjustments"
  ON public.quote_adjustments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employee full access on quote_adjustments"
  ON public.quote_adjustments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'employee'))
  WITH CHECK (public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Supervisor full access on quote_adjustments"
  ON public.quote_adjustments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

-- quote_events
CREATE POLICY "Admin full access on quote_events"
  ON public.quote_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employee full access on quote_events"
  ON public.quote_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'employee'))
  WITH CHECK (public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Supervisor full access on quote_events"
  ON public.quote_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

-- quote_approvals
CREATE POLICY "Admin full access on quote_approvals"
  ON public.quote_approvals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employee read access on quote_approvals"
  ON public.quote_approvals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'employee'));

CREATE POLICY "Supervisor full access on quote_approvals"
  ON public.quote_approvals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

-- Auto-update timestamps trigger
CREATE OR REPLACE FUNCTION public.update_quotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_quotes_updated_at();

-- Indexes for common queries
CREATE INDEX idx_quotes_status ON public.quotes(status);
CREATE INDEX idx_quotes_customer ON public.quotes(customer_user_id);
CREATE INDEX idx_quotes_created_by ON public.quotes(created_by_user_id);
CREATE INDEX idx_quotes_source_portal ON public.quotes(source_portal);
CREATE INDEX idx_quote_lines_quote_id ON public.quote_lines(quote_id);
CREATE INDEX idx_quote_adjustments_quote_id ON public.quote_adjustments(quote_id);
CREATE INDEX idx_quote_events_quote_id ON public.quote_events(quote_id);
CREATE INDEX idx_quote_approvals_quote_id ON public.quote_approvals(quote_id);

-- Quote number sequence trigger
CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    NEW.quote_number = 'QT-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 6));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_quote_number
  BEFORE INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.generate_quote_number();
