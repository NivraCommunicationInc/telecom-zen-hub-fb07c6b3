
-- Create sequence for account numbers
CREATE SEQUENCE IF NOT EXISTS account_seq START WITH 1;

-- Create accounts table
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_number text UNIQUE NOT NULL,
  account_name text DEFAULT 'Primary',
  billing_address text,
  billing_city text,
  billing_province text DEFAULT 'QC',
  billing_postal_code text,
  primary_service_address text,
  primary_service_city text,
  primary_service_province text DEFAULT 'QC',
  primary_service_postal_code text,
  billing_cycle_day integer DEFAULT 1 CHECK (billing_cycle_day >= 1 AND billing_cycle_day <= 28),
  billing_cycle_timezone text DEFAULT 'America/Toronto',
  status text DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  credit_class text DEFAULT 'C' CHECK (credit_class IN ('A', 'B', 'C', 'D')),
  credit_last_reviewed_at timestamptz,
  credit_last_reviewed_by_admin_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create account service locations table
CREATE TABLE public.account_service_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Primary',
  service_address text NOT NULL,
  service_city text,
  service_province text DEFAULT 'QC',
  service_postal_code text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Function to generate account number
CREATE OR REPLACE FUNCTION public.generate_account_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN 'NIV-ACCT-' || LPAD(nextval('account_seq')::TEXT, 6, '0');
END;
$$;

-- Trigger to set account number on insert
CREATE OR REPLACE FUNCTION public.set_account_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.account_number IS NULL THEN
    NEW.account_number := generate_account_number();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_account_number
  BEFORE INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_account_number();

-- Trigger for updated_at on accounts
CREATE TRIGGER trigger_update_accounts_timestamp
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on service locations
CREATE TRIGGER trigger_update_service_locations_timestamp
  BEFORE UPDATE ON public.account_service_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add account_id and service_location_id to orders
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id),
  ADD COLUMN IF NOT EXISTS service_location_id uuid REFERENCES public.account_service_locations(id);

-- Enable RLS on accounts
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for accounts (credit_class hidden from clients)
CREATE POLICY "Admins can manage all accounts"
  ON public.accounts FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can view accounts"
  ON public.accounts FOR SELECT
  USING (has_role(auth.uid(), 'employee'));

CREATE POLICY "Clients can view their own accounts"
  ON public.accounts FOR SELECT
  USING (auth.uid() = client_id);

CREATE POLICY "Clients can create their own accounts"
  ON public.accounts FOR INSERT
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients can update their own accounts (except credit_class)"
  ON public.accounts FOR UPDATE
  USING (auth.uid() = client_id);

-- Enable RLS on service locations
ALTER TABLE public.account_service_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all service locations"
  ON public.account_service_locations FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can view service locations"
  ON public.account_service_locations FOR SELECT
  USING (has_role(auth.uid(), 'employee'));

CREATE POLICY "Clients can manage their own service locations"
  ON public.account_service_locations FOR ALL
  USING (
    account_id IN (
      SELECT id FROM public.accounts WHERE client_id = auth.uid()
    )
  );

-- Technicians can view accounts for assigned work orders only
CREATE POLICY "Technicians can view assigned accounts"
  ON public.accounts FOR SELECT
  USING (
    has_role(auth.uid(), 'technician') AND
    id IN (
      SELECT o.account_id FROM public.orders o
      JOIN public.work_orders wo ON wo.linked_order_id = o.id
      JOIN public.technicians t ON wo.assigned_technician_id = t.id
      WHERE t.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_accounts_client_id ON public.accounts(client_id);
CREATE INDEX idx_accounts_account_number ON public.accounts(account_number);
CREATE INDEX idx_accounts_status ON public.accounts(status);
CREATE INDEX idx_service_locations_account_id ON public.account_service_locations(account_id);
CREATE INDEX idx_orders_account_id ON public.orders(account_id);
