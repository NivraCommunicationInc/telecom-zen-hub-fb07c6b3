-- Extend subscriptions table with billing cycle fields
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS activation_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS bill_cycle_day INTEGER CHECK (bill_cycle_day >= 1 AND bill_cycle_day <= 28),
ADD COLUMN IF NOT EXISTS next_invoice_date DATE,
ADD COLUMN IF NOT EXISTS last_invoiced_through DATE;

-- Create monthly_invoices table
CREATE TABLE public.monthly_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  invoice_number TEXT UNIQUE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'paid', 'overdue', 'void')),
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tps_amount NUMERIC DEFAULT 0,
  tvq_amount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Prevent duplicate invoices for same client and period
  CONSTRAINT unique_client_period UNIQUE (client_id, period_start)
);

-- Create monthly_invoice_lines table
CREATE TABLE public.monthly_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.monthly_invoices(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id),
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  line_total NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS monthly_invoice_seq START 1;

-- Function to generate monthly invoice number
CREATE OR REPLACE FUNCTION public.generate_monthly_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN 'MINV-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(nextval('monthly_invoice_seq')::TEXT, 5, '0');
END;
$$;

-- Trigger to set invoice number
CREATE OR REPLACE FUNCTION public.set_monthly_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := generate_monthly_invoice_number();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_monthly_invoice_number_trigger
BEFORE INSERT ON public.monthly_invoices
FOR EACH ROW EXECUTE FUNCTION public.set_monthly_invoice_number();

-- Trigger to update timestamps
CREATE TRIGGER update_monthly_invoices_timestamp
BEFORE UPDATE ON public.monthly_invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to set bill cycle on subscription activation
CREATE OR REPLACE FUNCTION public.set_subscription_bill_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only set when status changes to active/shipped/installed and activation_date is not set
  IF NEW.status IN ('active', 'shipped', 'installed', 'installation_completed') 
     AND (OLD.status IS NULL OR OLD.status NOT IN ('active', 'shipped', 'installed', 'installation_completed'))
     AND NEW.activation_date IS NULL THEN
    
    NEW.activation_date := now();
    -- Clamp bill cycle day to 1-28
    NEW.bill_cycle_day := LEAST(28, EXTRACT(DAY FROM NEW.activation_date)::INTEGER);
    
    -- Set next invoice date to the next occurrence of bill cycle day
    IF EXTRACT(DAY FROM CURRENT_DATE)::INTEGER <= NEW.bill_cycle_day THEN
      NEW.next_invoice_date := DATE_TRUNC('month', CURRENT_DATE) + (NEW.bill_cycle_day - 1) * INTERVAL '1 day';
    ELSE
      NEW.next_invoice_date := DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' + (NEW.bill_cycle_day - 1) * INTERVAL '1 day';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER subscription_bill_cycle_trigger
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_subscription_bill_cycle();

-- Indexes for performance
CREATE INDEX idx_monthly_invoices_client_id ON public.monthly_invoices(client_id);
CREATE INDEX idx_monthly_invoices_status ON public.monthly_invoices(status);
CREATE INDEX idx_monthly_invoices_due_date ON public.monthly_invoices(due_date);
CREATE INDEX idx_subscriptions_next_invoice ON public.subscriptions(next_invoice_date) WHERE status IN ('active', 'shipped', 'installed', 'installation_completed');

-- Enable RLS
ALTER TABLE public.monthly_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_invoice_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for monthly_invoices
CREATE POLICY "Admins can manage all monthly invoices"
ON public.monthly_invoices FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view all monthly invoices"
ON public.monthly_invoices FOR SELECT
USING (has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Employees can update invoice status"
ON public.monthly_invoices FOR UPDATE
USING (has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Clients can view their own invoices"
ON public.monthly_invoices FOR SELECT
USING (auth.uid() = client_id);

-- RLS Policies for monthly_invoice_lines
CREATE POLICY "Admins can manage all invoice lines"
ON public.monthly_invoice_lines FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view all invoice lines"
ON public.monthly_invoice_lines FOR SELECT
USING (has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Clients can view their own invoice lines"
ON public.monthly_invoice_lines FOR SELECT
USING (invoice_id IN (
  SELECT id FROM public.monthly_invoices WHERE client_id = auth.uid()
));

-- Backfill existing subscriptions with bill cycle data
UPDATE public.subscriptions
SET 
  activation_date = COALESCE(start_date, created_at),
  bill_cycle_day = LEAST(28, EXTRACT(DAY FROM COALESCE(start_date, created_at))::INTEGER),
  next_invoice_date = CASE 
    WHEN EXTRACT(DAY FROM CURRENT_DATE)::INTEGER <= LEAST(28, EXTRACT(DAY FROM COALESCE(start_date, created_at))::INTEGER)
    THEN DATE_TRUNC('month', CURRENT_DATE) + (LEAST(28, EXTRACT(DAY FROM COALESCE(start_date, created_at))::INTEGER) - 1) * INTERVAL '1 day'
    ELSE DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' + (LEAST(28, EXTRACT(DAY FROM COALESCE(start_date, created_at))::INTEGER) - 1) * INTERVAL '1 day'
  END
WHERE status IN ('active', 'shipped', 'installed', 'installation_completed')
  AND activation_date IS NULL;