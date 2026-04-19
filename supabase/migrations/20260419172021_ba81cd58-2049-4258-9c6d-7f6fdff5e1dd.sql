
-- ============================================================
-- PHONE INVENTORY
-- ============================================================
CREATE TABLE public.phone_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  storage TEXT NOT NULL,
  color TEXT NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('new','refurbished','used')),
  price_cad NUMERIC(10,2) NOT NULL CHECK (price_cad >= 0),
  purchase_price_cad NUMERIC(10,2),
  imei TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','sold','returned','defective')),
  photos TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  warranty_days INTEGER NOT NULL DEFAULT 30 CHECK (warranty_days >= 0),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_phone_inventory_status ON public.phone_inventory(status);
CREATE INDEX idx_phone_inventory_brand ON public.phone_inventory(brand);
CREATE INDEX idx_phone_inventory_order_id ON public.phone_inventory(order_id);

ALTER TABLE public.phone_inventory ENABLE ROW LEVEL SECURITY;

-- Public can view available phones (catalog)
CREATE POLICY "Public can view available phones"
  ON public.phone_inventory
  FOR SELECT
  USING (status = 'available');

-- Internal staff can view all phones
CREATE POLICY "Staff can view all phones"
  ON public.phone_inventory
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'employee') OR
    public.has_role(auth.uid(), 'supervisor')
  );

-- Service role only for writes (no client-side mutations)
CREATE POLICY "Admins can manage phone inventory"
  ON public.phone_inventory
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger (reuse existing helper)
CREATE TRIGGER trg_phone_inventory_updated_at
  BEFORE UPDATE ON public.phone_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PHONE ORDERS
-- ============================================================
CREATE TABLE public.phone_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  phone_inventory_id UUID NOT NULL REFERENCES public.phone_inventory(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending_kyc' CHECK (status IN (
    'pending_kyc','kyc_submitted','kyc_approved','risk_review',
    'approved','blocked','shipped','delivered',
    'return_requested','returned','refunded'
  )),
  fraud_score INTEGER NOT NULL DEFAULT 0,
  fraud_factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  fraud_level TEXT NOT NULL DEFAULT 'low' CHECK (fraud_level IN ('low','medium','high')),
  shipping_address JSONB,
  tracking_number TEXT,
  carrier TEXT,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  kyc_session_id UUID REFERENCES public.identity_verification_sessions(id) ON DELETE SET NULL,
  return_requested_at TIMESTAMPTZ,
  return_reason TEXT,
  return_imei TEXT,
  refunded_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_phone_orders_user_id ON public.phone_orders(user_id);
CREATE INDEX idx_phone_orders_order_id ON public.phone_orders(order_id);
CREATE INDEX idx_phone_orders_status ON public.phone_orders(status);
CREATE INDEX idx_phone_orders_fraud_level ON public.phone_orders(fraud_level);
CREATE INDEX idx_phone_orders_created_at ON public.phone_orders(created_at DESC);

ALTER TABLE public.phone_orders ENABLE ROW LEVEL SECURITY;

-- Customers see their own orders only
CREATE POLICY "Users can view own phone orders"
  ON public.phone_orders
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Staff sees all phone orders
CREATE POLICY "Staff can view all phone orders"
  ON public.phone_orders
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'employee') OR
    public.has_role(auth.uid(), 'supervisor')
  );

-- Admins can manage phone orders (status changes, refunds, etc.)
CREATE POLICY "Admins can manage phone orders"
  ON public.phone_orders
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_phone_orders_updated_at
  BEFORE UPDATE ON public.phone_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
