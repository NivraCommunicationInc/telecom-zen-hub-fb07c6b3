
-- Create replacement_reason enum
CREATE TYPE replacement_reason AS ENUM (
  'defective',
  'damaged',
  'lost',
  'theft',
  'malfunction',
  'upgrade',
  'other'
);

-- Create replacement_order_type enum
CREATE TYPE replacement_order_type AS ENUM (
  'warranty_replacement',
  'paid_replacement'
);

-- Create replacement_order_status enum
CREATE TYPE replacement_order_status AS ENUM (
  'open',
  'awaiting_decision',
  'awaiting_payment',
  'ready_to_ship',
  'shipped',
  'delivered',
  'cancelled',
  'closed'
);

-- Create replacement_tickets table
CREATE TABLE public.replacement_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text UNIQUE,
  user_id uuid NOT NULL,
  client_email text,
  
  -- Linked order/equipment
  linked_order_id uuid REFERENCES public.orders(id),
  linked_order_number text,
  equipment_id text,
  equipment_name text,
  equipment_serial text,
  
  -- Reason details
  reason replacement_reason NOT NULL DEFAULT 'other',
  reason_text text,
  reason_details text,
  
  -- Delivery preference
  preferred_address text,
  preferred_city text,
  preferred_postal_code text,
  
  -- Photos
  photo_urls jsonb DEFAULT '[]'::jsonb,
  
  -- Acknowledgement
  billable_acknowledged boolean DEFAULT false,
  
  -- Status
  status text DEFAULT 'open',
  
  -- Internal notes
  internal_notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sequence for ticket numbers
CREATE SEQUENCE IF NOT EXISTS replacement_ticket_seq START 1;

-- Create function to generate replacement ticket number
CREATE OR REPLACE FUNCTION public.generate_replacement_ticket_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN 'TKT-RPL-' || LPAD(nextval('replacement_ticket_seq')::TEXT, 5, '0');
END;
$$;

-- Create trigger for auto ticket number
CREATE OR REPLACE FUNCTION public.set_replacement_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := generate_replacement_ticket_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_replacement_ticket_number_trigger
  BEFORE INSERT ON public.replacement_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_replacement_ticket_number();

-- Create replacement_orders table
CREATE TABLE public.replacement_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE,
  
  -- Link to ticket
  replacement_ticket_id uuid REFERENCES public.replacement_tickets(id) ON DELETE CASCADE,
  
  -- Link to original order
  original_order_id uuid REFERENCES public.orders(id),
  original_order_number text,
  
  -- Client info
  user_id uuid NOT NULL,
  client_email text,
  
  -- Order type
  order_type replacement_order_type NOT NULL DEFAULT 'paid_replacement',
  
  -- Equipment details
  equipment_items jsonb DEFAULT '[]'::jsonb,
  
  -- Fees
  equipment_total numeric DEFAULT 0,
  delivery_fee numeric DEFAULT 0,
  admin_fee numeric DEFAULT 0,
  subtotal numeric DEFAULT 0,
  tps_amount numeric DEFAULT 0,
  tvq_amount numeric DEFAULT 0,
  total_amount numeric DEFAULT 0,
  
  -- Return requirement
  return_required boolean DEFAULT false,
  return_deadline date,
  
  -- Status
  status replacement_order_status DEFAULT 'awaiting_decision',
  
  -- Shipping
  shipping_address text,
  shipping_city text,
  shipping_postal_code text,
  shipping_method text DEFAULT 'standard',
  tracking_number text,
  tracking_url text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  
  -- Invoice
  invoice_id uuid REFERENCES public.billing(id),
  invoice_number text,
  invoice_status text DEFAULT 'unpaid',
  
  -- Payment
  payment_confirmed boolean DEFAULT false,
  payment_confirmed_at timestamptz,
  payment_confirmed_by uuid,
  payment_reference text,
  
  -- Approval/processing
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  
  -- Internal notes
  internal_notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sequence for replacement order numbers
CREATE SEQUENCE IF NOT EXISTS replacement_order_seq START 1;

-- Create function to generate replacement order number
CREATE OR REPLACE FUNCTION public.generate_replacement_order_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  ticket_part text;
  order_part text;
BEGIN
  RETURN 'RPL-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(nextval('replacement_order_seq')::TEXT, 5, '0');
END;
$$;

-- Create trigger for auto replacement order number
CREATE OR REPLACE FUNCTION public.set_replacement_order_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_replacement_order_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_replacement_order_number_trigger
  BEFORE INSERT ON public.replacement_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_replacement_order_number();

-- Trigger for calculating totals
CREATE OR REPLACE FUNCTION public.calculate_replacement_order_total()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.subtotal := COALESCE(NEW.equipment_total, 0) + COALESCE(NEW.delivery_fee, 0) + COALESCE(NEW.admin_fee, 0);
  NEW.tps_amount := ROUND(NEW.subtotal * 0.05, 2);
  NEW.tvq_amount := ROUND(NEW.subtotal * 0.09975, 2);
  NEW.total_amount := NEW.subtotal + NEW.tps_amount + NEW.tvq_amount;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER calculate_replacement_order_total_trigger
  BEFORE INSERT OR UPDATE ON public.replacement_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_replacement_order_total();

-- Enable RLS
ALTER TABLE public.replacement_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replacement_orders ENABLE ROW LEVEL SECURITY;

-- RLS for replacement_tickets
CREATE POLICY "Users can view their own replacement tickets"
  ON public.replacement_tickets FOR SELECT
  USING (
    auth.uid() = user_id OR 
    client_email = (SELECT email FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create their own replacement tickets"
  ON public.replacement_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own open tickets"
  ON public.replacement_tickets FOR UPDATE
  USING (auth.uid() = user_id AND status = 'open');

CREATE POLICY "Admins can manage all replacement tickets"
  ON public.replacement_tickets FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can manage replacement tickets"
  ON public.replacement_tickets FOR ALL
  USING (has_role(auth.uid(), 'employee'::app_role));

-- RLS for replacement_orders
CREATE POLICY "Users can view their own replacement orders"
  ON public.replacement_orders FOR SELECT
  USING (
    auth.uid() = user_id OR 
    client_email = (SELECT email FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage all replacement orders"
  ON public.replacement_orders FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can manage replacement orders"
  ON public.replacement_orders FOR ALL
  USING (has_role(auth.uid(), 'employee'::app_role));

-- Add indexes
CREATE INDEX idx_replacement_tickets_user_id ON public.replacement_tickets(user_id);
CREATE INDEX idx_replacement_tickets_status ON public.replacement_tickets(status);
CREATE INDEX idx_replacement_orders_ticket_id ON public.replacement_orders(replacement_ticket_id);
CREATE INDEX idx_replacement_orders_user_id ON public.replacement_orders(user_id);
CREATE INDEX idx_replacement_orders_status ON public.replacement_orders(status);
