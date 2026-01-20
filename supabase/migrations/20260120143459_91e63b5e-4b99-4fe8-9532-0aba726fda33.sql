-- =====================================================
-- NIVRA BILLING SYSTEM V2 - Phase 1: Schema
-- =====================================================

-- 1. ENUM Types
CREATE TYPE billing_customer_status AS ENUM ('active', 'suspended', 'closed');
CREATE TYPE billing_subscription_status AS ENUM ('active', 'pending', 'suspended', 'cancelled');
CREATE TYPE billing_invoice_type AS ENUM ('initial', 'renewal', 'adjustment', 'credit');
CREATE TYPE billing_invoice_status AS ENUM ('draft', 'pending', 'paid', 'failed', 'cancelled', 'refunded');
CREATE TYPE billing_payment_method AS ENUM ('interac', 'stripe', 'square', 'manual');
CREATE TYPE billing_payment_status AS ENUM ('pending', 'confirmed', 'failed');

-- 2. TABLE: billing_customers
CREATE TABLE public.billing_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  status billing_customer_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TABLE: billing_subscriptions
CREATE TABLE public.billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.billing_customers(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  plan_price NUMERIC(10,2) NOT NULL,
  cycle_start_date DATE NOT NULL,
  cycle_end_date DATE NOT NULL,
  status billing_subscription_status DEFAULT 'pending',
  last_invoice_id UUID NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TABLE: billing_invoices
CREATE TABLE public.billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES public.billing_customers(id) ON DELETE CASCADE,
  invoice_number TEXT UNIQUE NOT NULL,
  type billing_invoice_type NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tps_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  tvq_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'CAD',
  payment_method billing_payment_method DEFAULT 'interac',
  status billing_invoice_status DEFAULT 'pending',
  cycle_start_date DATE NOT NULL,
  cycle_end_date DATE NOT NULL,
  due_date DATE NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ NULL
);

-- 5. TABLE: billing_invoice_lines
CREATE TABLE public.billing_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INT DEFAULT 1,
  line_total NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. TABLE: billing_payments
CREATE TABLE public.billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.billing_customers(id) ON DELETE CASCADE,
  method billing_payment_method NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status billing_payment_status DEFAULT 'pending',
  reference TEXT NULL,
  received_at TIMESTAMPTZ NULL,
  confirmed_by UUID NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. INDEXES for performance
CREATE INDEX idx_billing_subscriptions_customer ON public.billing_subscriptions(customer_id);
CREATE INDEX idx_billing_subscriptions_status ON public.billing_subscriptions(status);
CREATE INDEX idx_billing_subscriptions_cycle_end ON public.billing_subscriptions(cycle_end_date);
CREATE INDEX idx_billing_invoices_customer ON public.billing_invoices(customer_id);
CREATE INDEX idx_billing_invoices_subscription ON public.billing_invoices(subscription_id);
CREATE INDEX idx_billing_invoices_status ON public.billing_invoices(status);
CREATE INDEX idx_billing_invoices_due_date ON public.billing_invoices(due_date);
CREATE INDEX idx_billing_payments_invoice ON public.billing_payments(invoice_id);
CREATE INDEX idx_billing_payments_status ON public.billing_payments(status);

-- 8. TRIGGER: Auto-update subscription when invoice is paid
CREATE OR REPLACE FUNCTION public.billing_invoice_paid_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    -- Update the subscription
    UPDATE public.billing_subscriptions
    SET 
      status = 'active',
      last_invoice_id = NEW.id,
      cycle_start_date = NEW.cycle_start_date,
      cycle_end_date = NEW.cycle_end_date,
      updated_at = now()
    WHERE id = NEW.subscription_id;
    
    -- Mark payment as confirmed if exists
    UPDATE public.billing_payments
    SET 
      status = 'confirmed',
      received_at = COALESCE(received_at, now())
    WHERE invoice_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_billing_invoice_paid
  AFTER UPDATE ON public.billing_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.billing_invoice_paid_trigger();

-- 9. TRIGGER: Auto-suspend subscription when invoice fails
CREATE OR REPLACE FUNCTION public.billing_invoice_failed_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'failed' AND OLD.status != 'failed' THEN
    UPDATE public.billing_subscriptions
    SET 
      status = 'suspended',
      updated_at = now()
    WHERE id = NEW.subscription_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_billing_invoice_failed
  AFTER UPDATE ON public.billing_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.billing_invoice_failed_trigger();

-- 10. TRIGGER: Update customer status based on subscriptions
CREATE OR REPLACE FUNCTION public.billing_subscription_status_trigger()
RETURNS TRIGGER AS $$
DECLARE
  active_count INT;
  suspended_count INT;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE status = 'active'),
    COUNT(*) FILTER (WHERE status = 'suspended')
  INTO active_count, suspended_count
  FROM public.billing_subscriptions
  WHERE customer_id = NEW.customer_id;
  
  IF active_count > 0 THEN
    UPDATE public.billing_customers SET status = 'active', updated_at = now() WHERE id = NEW.customer_id;
  ELSIF suspended_count > 0 THEN
    UPDATE public.billing_customers SET status = 'suspended', updated_at = now() WHERE id = NEW.customer_id;
  ELSE
    UPDATE public.billing_customers SET status = 'closed', updated_at = now() WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_billing_subscription_status
  AFTER INSERT OR UPDATE ON public.billing_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.billing_subscription_status_trigger();

-- 11. FUNCTION: Generate invoice number
CREATE OR REPLACE FUNCTION public.generate_billing_invoice_number()
RETURNS TEXT AS $$
DECLARE
  prefix TEXT := 'INV';
  year_month TEXT := to_char(now(), 'YYMM');
  seq INT;
BEGIN
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(invoice_number, '[^0-9]', '', 'g'), '') AS INT)
  ), 0) + 1
  INTO seq
  FROM public.billing_invoices
  WHERE invoice_number LIKE prefix || '-' || year_month || '-%';
  
  RETURN prefix || '-' || year_month || '-' || LPAD(seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 12. FUNCTION: Calculate proration for plan change
CREATE OR REPLACE FUNCTION public.calculate_billing_proration(
  p_subscription_id UUID,
  p_new_price NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
  v_old_price NUMERIC;
  v_cycle_end DATE;
  v_days_remaining INT;
  v_proration NUMERIC;
BEGIN
  SELECT plan_price, cycle_end_date
  INTO v_old_price, v_cycle_end
  FROM public.billing_subscriptions
  WHERE id = p_subscription_id;
  
  v_days_remaining := v_cycle_end - CURRENT_DATE;
  
  IF v_days_remaining <= 0 THEN
    RETURN 0;
  END IF;
  
  v_proration := (p_new_price - v_old_price) * (v_days_remaining::NUMERIC / 30);
  RETURN ROUND(v_proration, 2);
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 13. RLS Policies
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;

-- Admin full access (uses admin_users table)
CREATE POLICY "Admins full access billing_customers" ON public.billing_customers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Admins full access billing_subscriptions" ON public.billing_subscriptions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Admins full access billing_invoices" ON public.billing_invoices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Admins full access billing_invoice_lines" ON public.billing_invoice_lines
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Admins full access billing_payments" ON public.billing_payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
  );

-- Clients can view their own data
CREATE POLICY "Clients view own billing_customers" ON public.billing_customers
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Clients view own billing_subscriptions" ON public.billing_subscriptions
  FOR SELECT USING (
    customer_id IN (SELECT id FROM public.billing_customers WHERE user_id = auth.uid())
  );

CREATE POLICY "Clients view own billing_invoices" ON public.billing_invoices
  FOR SELECT USING (
    customer_id IN (SELECT id FROM public.billing_customers WHERE user_id = auth.uid())
  );

CREATE POLICY "Clients view own billing_invoice_lines" ON public.billing_invoice_lines
  FOR SELECT USING (
    invoice_id IN (
      SELECT id FROM public.billing_invoices 
      WHERE customer_id IN (SELECT id FROM public.billing_customers WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Clients view own billing_payments" ON public.billing_payments
  FOR SELECT USING (
    customer_id IN (SELECT id FROM public.billing_customers WHERE user_id = auth.uid())
  );