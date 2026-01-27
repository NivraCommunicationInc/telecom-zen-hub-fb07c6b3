-- ========================================
-- FIELD SALES ENHANCED FEATURES MIGRATION
-- Adds: GPS, Photos, Signatures, Commissions, Cashouts
-- ========================================

-- Add GPS, signature, and photo columns to field_sales_orders
ALTER TABLE public.field_sales_orders 
ADD COLUMN IF NOT EXISTS gps_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS gps_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS gps_accuracy DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS gps_captured_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS signature_captured_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS customer_id_photo_url TEXT,
ADD COLUMN IF NOT EXISTS location_photo_url TEXT,
ADD COLUMN IF NOT EXISTS additional_photos JSONB DEFAULT '[]'::jsonb;

-- Add commission bonus tiers and tracking columns to sales_commissions
ALTER TABLE public.sales_commissions
ADD COLUMN IF NOT EXISTS bonus_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_type TEXT,
ADD COLUMN IF NOT EXISTS validated_by TEXT,
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Create commission rules table for configurable bonuses
CREATE TABLE IF NOT EXISTS public.field_sales_commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('base_rate', 'volume_bonus', 'service_bonus', 'territory_bonus')),
  service_type TEXT, -- null means all services
  min_sales INTEGER DEFAULT 0,
  max_sales INTEGER,
  bonus_amount DECIMAL(10, 2) DEFAULT 0,
  bonus_percentage DECIMAL(5, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create cashout requests table for commission withdrawals
CREATE TABLE IF NOT EXISTS public.field_sales_cashout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT UNIQUE,
  salesperson_id UUID NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('interac', 'cheque', 'cash')),
  destination TEXT NOT NULL, -- email for interac, address for cheque
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  admin_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for cashout requests by salesperson
CREATE INDEX IF NOT EXISTS idx_field_cashout_salesperson ON public.field_sales_cashout_requests(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_field_cashout_status ON public.field_sales_cashout_requests(status);

-- Create leaderboard view for performance tracking
CREATE OR REPLACE VIEW public.field_sales_leaderboard AS
SELECT 
  ur.user_id,
  p.full_name,
  p.email,
  COUNT(DISTINCT fso.id) as total_sales,
  COALESCE(SUM(fso.total_amount), 0) as total_revenue,
  COALESCE(SUM(sc.commission_amount), 0) as total_commissions,
  COALESCE(SUM(sc.bonus_amount), 0) as total_bonuses,
  COUNT(DISTINCT CASE WHEN fso.created_at >= CURRENT_DATE THEN fso.id END) as sales_today,
  COUNT(DISTINCT CASE WHEN fso.created_at >= date_trunc('week', CURRENT_DATE) THEN fso.id END) as sales_this_week,
  COUNT(DISTINCT CASE WHEN fso.created_at >= date_trunc('month', CURRENT_DATE) THEN fso.id END) as sales_this_month
FROM public.user_roles ur
JOIN public.profiles p ON p.user_id = ur.user_id
LEFT JOIN public.field_sales_orders fso ON fso.salesperson_id = ur.user_id
LEFT JOIN public.sales_commissions sc ON sc.salesperson_id = ur.user_id
WHERE ur.role = 'field_sales' AND ur.is_active = true
GROUP BY ur.user_id, p.full_name, p.email
ORDER BY total_sales DESC;

-- Enable RLS on new tables
ALTER TABLE public.field_sales_commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_sales_cashout_requests ENABLE ROW LEVEL SECURITY;

-- Commission rules: admins only
CREATE POLICY "Admins can manage commission rules" ON public.field_sales_commission_rules
  FOR ALL USING (public.is_admin());

CREATE POLICY "Field sales can view commission rules" ON public.field_sales_commission_rules
  FOR SELECT USING (public.is_field_sales(auth.uid()));

-- Cashout requests: salesperson can view own, admins can manage all
CREATE POLICY "Salesperson can view own cashout requests" ON public.field_sales_cashout_requests
  FOR SELECT USING (auth.uid() = salesperson_id);

CREATE POLICY "Salesperson can create cashout requests" ON public.field_sales_cashout_requests
  FOR INSERT WITH CHECK (auth.uid() = salesperson_id);

CREATE POLICY "Admins can manage all cashout requests" ON public.field_sales_cashout_requests
  FOR ALL USING (public.is_admin());

-- Function to generate cashout request number
CREATE OR REPLACE FUNCTION public.generate_cashout_request_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.request_number := 'CO-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(NEW.id::TEXT, 1, 4);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for cashout request number
DROP TRIGGER IF EXISTS trg_generate_cashout_number ON public.field_sales_cashout_requests;
CREATE TRIGGER trg_generate_cashout_number
  BEFORE INSERT ON public.field_sales_cashout_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_cashout_request_number();

-- Insert default commission rules
INSERT INTO public.field_sales_commission_rules (rule_name, rule_type, service_type, bonus_percentage, is_active)
VALUES 
  ('Commission base Internet', 'base_rate', 'internet', 10.00, true),
  ('Commission base TV', 'base_rate', 'tv', 10.00, true),
  ('Commission base Mobile', 'base_rate', 'mobile', 10.00, true),
  ('Commission base Bundle', 'base_rate', 'bundle', 12.00, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.field_sales_commission_rules (rule_name, rule_type, min_sales, bonus_amount, is_active)
VALUES 
  ('Bonus 10 ventes', 'volume_bonus', 10, 50.00, true),
  ('Bonus 25 ventes', 'volume_bonus', 25, 150.00, true),
  ('Bonus 50 ventes', 'volume_bonus', 50, 400.00, true)
ON CONFLICT DO NOTHING;