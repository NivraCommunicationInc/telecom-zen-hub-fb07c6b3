-- Table for tracking field sales orders (with offline support)
CREATE TABLE public.field_sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id TEXT, -- Client-side generated ID for offline tracking
  salesperson_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Customer info (collected on the spot)
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  customer_city TEXT,
  customer_postal_code TEXT,
  customer_date_of_birth DATE,
  
  -- Services selected
  services JSONB NOT NULL DEFAULT '[]',
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  
  -- Payment info
  payment_method TEXT CHECK (payment_method IN ('interac', 'paypal', 'deferred')),
  payment_reference TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'confirmed', 'failed')),
  
  -- Appointment
  appointment_date TIMESTAMPTZ,
  appointment_notes TEXT,
  
  -- TV Channels if applicable
  selected_channels JSONB DEFAULT '[]',
  
  -- Sync status for offline
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('pending', 'syncing', 'synced', 'error')),
  sync_error TEXT,
  synced_at TIMESTAMPTZ,
  
  -- Geolocation (optional)
  sale_latitude NUMERIC(10,7),
  sale_longitude NUMERIC(10,7),
  
  -- Converted to real order
  converted_order_id UUID REFERENCES public.orders(id),
  converted_at TIMESTAMPTZ,
  
  -- Metadata
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.field_sales_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies: field_sales can manage their own orders
CREATE POLICY "Field sales can view own orders"
  ON public.field_sales_orders FOR SELECT
  USING (salesperson_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Field sales can create orders"
  ON public.field_sales_orders FOR INSERT
  WITH CHECK (salesperson_id = auth.uid());

CREATE POLICY "Field sales can update own orders"
  ON public.field_sales_orders FOR UPDATE
  USING (salesperson_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Admins full access
CREATE POLICY "Admins can manage all field orders"
  ON public.field_sales_orders FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Table for sales commissions
CREATE TABLE public.sales_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salesperson_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_order_id UUID REFERENCES public.field_sales_orders(id) ON DELETE SET NULL,
  converted_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  
  -- Commission details
  sale_amount NUMERIC(10,2) NOT NULL,
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.05, -- 5% default
  commission_amount NUMERIC(10,2) NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'paid', 'cancelled')),
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES auth.users(id),
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES auth.users(id),
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales_commissions ENABLE ROW LEVEL SECURITY;

-- RLS: Salespeople can view their own commissions
CREATE POLICY "Salespeople can view own commissions"
  ON public.sales_commissions FOR SELECT
  USING (salesperson_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Only admins can manage commissions
CREATE POLICY "Admins can manage commissions"
  ON public.sales_commissions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Function to check if user has field_sales role
CREATE OR REPLACE FUNCTION public.is_field_sales(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'field_sales'
      AND status = 'active'
  )
$$;

-- Update timestamp trigger
CREATE TRIGGER update_field_sales_orders_updated_at
  BEFORE UPDATE ON public.field_sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_commissions_updated_at
  BEFORE UPDATE ON public.sales_commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_field_sales_orders_salesperson ON public.field_sales_orders(salesperson_id);
CREATE INDEX idx_field_sales_orders_sync_status ON public.field_sales_orders(sync_status);
CREATE INDEX idx_field_sales_orders_created_at ON public.field_sales_orders(created_at DESC);
CREATE INDEX idx_sales_commissions_salesperson ON public.sales_commissions(salesperson_id);
CREATE INDEX idx_sales_commissions_status ON public.sales_commissions(status);