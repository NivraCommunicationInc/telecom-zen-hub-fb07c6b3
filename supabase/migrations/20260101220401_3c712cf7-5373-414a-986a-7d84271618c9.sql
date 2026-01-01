-- =============================================
-- REPLACEMENT/ACCESSORY REQUEST WORKFLOW SCHEMA
-- =============================================

-- 1) Create enum types for the workflow
DO $$ BEGIN
  CREATE TYPE replacement_ticket_category AS ENUM ('replacement', 'sim', 'accessory', 'phone', 'equipment', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE replacement_ticket_reason AS ENUM ('lost', 'stolen', 'broken', 'defective', 'upgrade', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE replacement_ticket_status AS ENUM (
    'open', 'needs_quote', 'quote_sent', 'quote_approved', 
    'invoiced', 'awaiting_payment', 'paid', 
    'fulfillment_in_progress', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE fulfillment_type AS ENUM ('ship', 'technician', 'pickup');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE internal_order_status AS ENUM (
    'draft', 'quoted', 'invoiced', 'awaiting_payment', 
    'ready_to_fulfill', 'shipped', 'tech_dispatched', 
    'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Create replacement_request_tickets table (client-visible)
CREATE TABLE IF NOT EXISTS public.replacement_request_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE,
  user_id UUID NOT NULL,
  account_id UUID REFERENCES public.accounts(id),
  service_location_id UUID REFERENCES public.account_service_locations(id),
  client_email TEXT,
  client_name TEXT,
  
  -- Request details
  category TEXT NOT NULL DEFAULT 'replacement',
  reason TEXT NOT NULL DEFAULT 'other',
  reason_details TEXT,
  client_message TEXT,
  preferred_fulfillment TEXT DEFAULT 'ship',
  
  -- Photos/attachments
  attachment_urls JSONB DEFAULT '[]'::jsonb,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT DEFAULT 'normal',
  
  -- Acknowledgements
  billable_acknowledged BOOLEAN DEFAULT false,
  
  -- Timeline/audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Internal (not visible to client in queries)
  internal_notes TEXT,
  assigned_to_id UUID,
  assigned_to_name TEXT
);

-- Create sequence for ticket numbers
CREATE SEQUENCE IF NOT EXISTS replacement_request_ticket_seq START 1;

-- 3) Create replacement_internal_orders table (ADMIN/EMPLOYEE ONLY)
CREATE TABLE IF NOT EXISTS public.replacement_internal_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE,
  ticket_id UUID NOT NULL REFERENCES public.replacement_request_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  account_id UUID,
  
  -- Fulfillment details
  fulfillment_type TEXT DEFAULT 'ship',
  delivery_method TEXT DEFAULT 'standard',
  delivery_fee NUMERIC DEFAULT 0,
  installation_selected BOOLEAN DEFAULT false,
  installation_fee NUMERIC DEFAULT 0,
  technician_required BOOLEAN DEFAULT false,
  
  -- Address snapshot
  service_address TEXT,
  service_city TEXT,
  service_postal_code TEXT,
  service_province TEXT DEFAULT 'QC',
  
  -- Totals (calculated)
  items_subtotal NUMERIC DEFAULT 0,
  subtotal NUMERIC DEFAULT 0,
  tps_amount NUMERIC DEFAULT 0,
  tvq_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  
  -- Quote mode
  is_quote BOOLEAN DEFAULT false,
  quote_approved_at TIMESTAMPTZ,
  quote_approved_by TEXT,
  
  -- Return requirement
  return_required BOOLEAN DEFAULT false,
  return_deadline DATE,
  return_fee NUMERIC DEFAULT 0,
  return_received BOOLEAN DEFAULT false,
  
  -- Status
  status TEXT DEFAULT 'draft',
  
  -- Invoice link
  invoice_id UUID,
  invoice_number TEXT,
  invoice_status TEXT,
  payment_confirmed BOOLEAN DEFAULT false,
  payment_confirmed_at TIMESTAMPTZ,
  payment_confirmed_by TEXT,
  payment_reference TEXT,
  
  -- Internal notes (NEVER visible to client)
  notes_internal TEXT,
  
  -- Tracking
  created_by_role TEXT,
  created_by_id UUID,
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create sequence for internal order numbers
CREATE SEQUENCE IF NOT EXISTS replacement_internal_order_seq START 1;

-- 4) Create replacement_order_items table
CREATE TABLE IF NOT EXISTS public.replacement_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.replacement_internal_orders(id) ON DELETE CASCADE,
  
  item_type TEXT NOT NULL, -- sim, equipment, phone, accessory, router, terminal
  item_name TEXT NOT NULL,
  sku TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  taxable BOOLEAN DEFAULT true,
  line_total NUMERIC DEFAULT 0,
  
  -- Stock status
  in_stock BOOLEAN DEFAULT true,
  backorder_eta DATE,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5) Create replacement_shipments table
CREATE TABLE IF NOT EXISTS public.replacement_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.replacement_internal_orders(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES public.replacement_request_tickets(id),
  
  carrier TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  
  shipped_at TIMESTAMPTZ,
  estimated_delivery DATE,
  delivered_at TIMESTAMPTZ,
  
  status TEXT DEFAULT 'pending', -- pending, shipped, in_transit, delivered
  
  shipped_by_id UUID,
  shipped_by_name TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6) Create replacement_timeline table for audit/events
CREATE TABLE IF NOT EXISTS public.replacement_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.replacement_request_tickets(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.replacement_internal_orders(id) ON DELETE CASCADE,
  
  event_type TEXT NOT NULL, -- ticket_created, order_created, invoice_issued, payment_received, shipped, etc.
  event_title TEXT NOT NULL,
  event_description TEXT,
  
  -- Visibility control
  visible_to_client BOOLEAN DEFAULT true,
  
  -- Actor info
  actor_id UUID,
  actor_name TEXT,
  actor_role TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7) Add fields to billing table for replacement orders
ALTER TABLE public.billing 
  ADD COLUMN IF NOT EXISTS replacement_ticket_id UUID REFERENCES public.replacement_request_tickets(id),
  ADD COLUMN IF NOT EXISTS replacement_order_id UUID REFERENCES public.replacement_internal_orders(id);

-- 8) Add fields to work_orders table for replacement orders
ALTER TABLE public.work_orders 
  ADD COLUMN IF NOT EXISTS replacement_order_id UUID REFERENCES public.replacement_internal_orders(id),
  ADD COLUMN IF NOT EXISTS replacement_ticket_id UUID REFERENCES public.replacement_request_tickets(id);

-- 9) Create trigger functions for auto-generating numbers
CREATE OR REPLACE FUNCTION public.generate_replacement_request_ticket_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN 'RRT-' || LPAD(nextval('replacement_request_ticket_seq')::TEXT, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_replacement_request_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := generate_replacement_request_ticket_number();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_replacement_internal_order_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN 'RIO-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(nextval('replacement_internal_order_seq')::TEXT, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_replacement_internal_order_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_replacement_internal_order_number();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS set_replacement_request_ticket_number_trigger ON public.replacement_request_tickets;
CREATE TRIGGER set_replacement_request_ticket_number_trigger
  BEFORE INSERT ON public.replacement_request_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_replacement_request_ticket_number();

DROP TRIGGER IF EXISTS set_replacement_internal_order_number_trigger ON public.replacement_internal_orders;
CREATE TRIGGER set_replacement_internal_order_number_trigger
  BEFORE INSERT ON public.replacement_internal_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_replacement_internal_order_number();

-- 10) Enable RLS on all new tables
ALTER TABLE public.replacement_request_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replacement_internal_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replacement_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replacement_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replacement_timeline ENABLE ROW LEVEL SECURITY;

-- 11) RLS Policies for replacement_request_tickets (Client can see their own)
CREATE POLICY "Clients can view their own replacement tickets"
  ON public.replacement_request_tickets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Clients can create replacement tickets"
  ON public.replacement_request_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Clients can update their own open tickets"
  ON public.replacement_request_tickets FOR UPDATE
  USING (auth.uid() = user_id AND status = 'open');

CREATE POLICY "Admins can manage all replacement tickets"
  ON public.replacement_request_tickets FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can view and update replacement tickets"
  ON public.replacement_request_tickets FOR ALL
  USING (has_role(auth.uid(), 'employee'));

-- 12) RLS Policies for replacement_internal_orders (ADMIN/EMPLOYEE ONLY - Client NEVER sees)
CREATE POLICY "Admins can manage internal orders"
  ON public.replacement_internal_orders FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can manage internal orders"
  ON public.replacement_internal_orders FOR ALL
  USING (has_role(auth.uid(), 'employee'));

-- NO CLIENT POLICY - Clients cannot see internal orders

-- 13) RLS Policies for replacement_order_items (ADMIN/EMPLOYEE ONLY)
CREATE POLICY "Admins can manage order items"
  ON public.replacement_order_items FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can manage order items"
  ON public.replacement_order_items FOR ALL
  USING (has_role(auth.uid(), 'employee'));

-- 14) RLS Policies for replacement_shipments
CREATE POLICY "Clients can view their shipments"
  ON public.replacement_shipments FOR SELECT
  USING (
    ticket_id IN (
      SELECT id FROM public.replacement_request_tickets WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage shipments"
  ON public.replacement_shipments FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can manage shipments"
  ON public.replacement_shipments FOR ALL
  USING (has_role(auth.uid(), 'employee'));

-- 15) RLS Policies for replacement_timeline
CREATE POLICY "Clients can view their visible timeline events"
  ON public.replacement_timeline FOR SELECT
  USING (
    visible_to_client = true AND
    ticket_id IN (
      SELECT id FROM public.replacement_request_tickets WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage timeline"
  ON public.replacement_timeline FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can manage timeline"
  ON public.replacement_timeline FOR ALL
  USING (has_role(auth.uid(), 'employee'));

-- 16) Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_replacement_request_tickets_user ON public.replacement_request_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_replacement_request_tickets_status ON public.replacement_request_tickets(status);
CREATE INDEX IF NOT EXISTS idx_replacement_request_tickets_account ON public.replacement_request_tickets(account_id);
CREATE INDEX IF NOT EXISTS idx_replacement_internal_orders_ticket ON public.replacement_internal_orders(ticket_id);
CREATE INDEX IF NOT EXISTS idx_replacement_internal_orders_status ON public.replacement_internal_orders(status);
CREATE INDEX IF NOT EXISTS idx_replacement_order_items_order ON public.replacement_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_replacement_shipments_order ON public.replacement_shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_replacement_timeline_ticket ON public.replacement_timeline(ticket_id);