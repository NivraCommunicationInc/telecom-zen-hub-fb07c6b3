
-- =====================================================================
-- ORDER SNAPSHOTS & DOCUMENT MANAGEMENT SYSTEM (COMPLETE)
-- =====================================================================

-- 1) Add missing columns to orders table first
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'Standard Québec Delivery';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS agreement_version INTEGER DEFAULT 1;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS confirmation_number TEXT;

-- 2) Create sequence for confirmation numbers
CREATE SEQUENCE IF NOT EXISTS confirmation_number_seq START WITH 1000;

-- 3) Function to generate confirmation number
CREATE OR REPLACE FUNCTION public.generate_confirmation_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN 'NVR-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(nextval('confirmation_number_seq')::TEXT, 5, '0');
END;
$$;

-- 4) Trigger to auto-set confirmation number
CREATE OR REPLACE FUNCTION public.set_confirmation_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.confirmation_number IS NULL THEN
    NEW.confirmation_number := generate_confirmation_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_confirmation_number_trigger ON public.orders;
CREATE TRIGGER set_confirmation_number_trigger
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_confirmation_number();

-- 5) Order Snapshots (immutable snapshot at checkout)
CREATE TABLE public.order_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  
  -- Client info snapshot
  client_snapshot JSONB NOT NULL DEFAULT '{}',
  -- Services selected snapshot
  services_snapshot JSONB NOT NULL DEFAULT '[]',
  -- Equipment selected snapshot
  equipment_snapshot JSONB NOT NULL DEFAULT '[]',
  -- Fees snapshot
  fees_snapshot JSONB NOT NULL DEFAULT '{}',
  -- Billing totals snapshot (MRC, OTC, subtotal, GST, QST, totalDueToday, etc.)
  billing_snapshot JSONB NOT NULL DEFAULT '{}',
  
  -- Acceptance timestamps
  accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_ip TEXT,
  accepted_method TEXT DEFAULT 'electronic',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_order_snapshot_version UNIQUE (order_id, version)
);

-- 6) Fulfillment Snapshots (evolves over time as order progresses)
CREATE TABLE public.fulfillment_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 2,
  
  -- Delivery
  delivery_method TEXT DEFAULT 'Standard Québec Delivery',
  delivery_fee NUMERIC DEFAULT 0,
  tracking_number TEXT,
  tracking_url TEXT,
  
  -- Installation
  installation_selected BOOLEAN DEFAULT false,
  installation_fee NUMERIC DEFAULT 0,
  technician_eta TEXT,
  technician_id UUID REFERENCES public.technicians(id),
  
  -- Invoice & Payment
  invoice_number TEXT,
  invoice_id UUID REFERENCES public.billing(id),
  payment_method TEXT,
  payment_status TEXT DEFAULT 'unpaid',
  payment_reference TEXT,
  
  -- Equipment IDs (serials/SIM/terminal IDs)
  equipment_ids JSONB DEFAULT '[]',
  
  -- Audit trail
  updated_by_role TEXT,
  updated_by_name TEXT,
  updated_by_id UUID,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_fulfillment_version UNIQUE (order_id, version)
);

-- 7) Order Documents (stores generated PDF references)
CREATE TABLE public.order_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  
  -- Document storage - URL only
  pdf_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  
  -- Metadata
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  generated_by UUID,
  generated_by_role TEXT,
  
  -- Snapshot references
  order_snapshot_id UUID REFERENCES public.order_snapshots(id),
  fulfillment_snapshot_id UUID REFERENCES public.fulfillment_snapshots(id),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_order_document_version UNIQUE (order_id, doc_type, version)
);

-- 8) RLS Policies for order_snapshots
ALTER TABLE public.order_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own order snapshots"
  ON public.order_snapshots FOR SELECT
  USING (order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()));

CREATE POLICY "Users can create their own order snapshots"
  ON public.order_snapshots FOR INSERT
  WITH CHECK (order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all order snapshots"
  ON public.order_snapshots FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 9) RLS Policies for fulfillment_snapshots
ALTER TABLE public.fulfillment_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own fulfillment snapshots"
  ON public.fulfillment_snapshots FOR SELECT
  USING (order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all fulfillment snapshots"
  ON public.fulfillment_snapshots FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can manage fulfillment snapshots"
  ON public.fulfillment_snapshots FOR ALL
  USING (has_role(auth.uid(), 'employee'::app_role));

-- 10) RLS Policies for order_documents
ALTER TABLE public.order_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own order documents"
  ON public.order_documents FOR SELECT
  USING (order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()));

CREATE POLICY "Users can create their own order documents"
  ON public.order_documents FOR INSERT
  WITH CHECK (order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all order documents"
  ON public.order_documents FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can manage order documents"
  ON public.order_documents FOR ALL
  USING (has_role(auth.uid(), 'employee'::app_role));

-- 11) Indexes for performance
CREATE INDEX idx_order_snapshots_order_id ON public.order_snapshots(order_id);
CREATE INDEX idx_fulfillment_snapshots_order_id ON public.fulfillment_snapshots(order_id);
CREATE INDEX idx_order_documents_order_id ON public.order_documents(order_id);
CREATE INDEX idx_order_documents_doc_type ON public.order_documents(doc_type);
CREATE INDEX idx_orders_confirmation_number ON public.orders(confirmation_number);

-- 12) Update timestamp trigger for fulfillment_snapshots
CREATE OR REPLACE FUNCTION public.update_fulfillment_snapshot_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_fulfillment_snapshot_timestamp_trigger
  BEFORE UPDATE ON public.fulfillment_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fulfillment_snapshot_timestamp();
