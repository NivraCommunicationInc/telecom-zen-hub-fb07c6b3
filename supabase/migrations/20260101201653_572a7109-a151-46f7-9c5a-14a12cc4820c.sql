-- Create promotions table
CREATE TABLE public.promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed_amount')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  applies_to JSONB NOT NULL DEFAULT '{"services": true, "one_time_fees": true, "equipment": true, "delivery": true, "installation": true}'::jsonb,
  scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'restricted')),
  restricted_client_ids UUID[] DEFAULT NULL,
  restricted_email_domains TEXT[] DEFAULT NULL,
  min_subtotal NUMERIC DEFAULT NULL,
  max_discount_amount NUMERIC DEFAULT NULL,
  start_at TIMESTAMPTZ DEFAULT NULL,
  end_at TIMESTAMPTZ DEFAULT NULL,
  usage_limit_total INTEGER DEFAULT NULL,
  usage_limit_per_client INTEGER DEFAULT NULL,
  stackable BOOLEAN NOT NULL DEFAULT false,
  created_by_admin_id UUID DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_percent CHECK (discount_type != 'percent' OR (discount_value >= 0 AND discount_value <= 100)),
  CONSTRAINT valid_date_range CHECK (start_at IS NULL OR end_at IS NULL OR start_at < end_at)
);

-- Create unique index on uppercase code
CREATE UNIQUE INDEX promotions_code_unique ON public.promotions (UPPER(TRIM(code)));

-- Create promotion_redemptions table
CREATE TABLE public.promotion_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  order_id UUID DEFAULT NULL,
  order_number TEXT DEFAULT NULL,
  client_id UUID DEFAULT NULL,
  client_email TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  discount_amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CAD'
);

-- Create indexes
CREATE INDEX idx_promotions_code ON public.promotions (UPPER(code));
CREATE INDEX idx_promotions_status ON public.promotions (status);
CREATE INDEX idx_promotion_redemptions_promotion_id ON public.promotion_redemptions (promotion_id);
CREATE INDEX idx_promotion_redemptions_client_email ON public.promotion_redemptions (client_email);
CREATE INDEX idx_promotion_redemptions_order_id ON public.promotion_redemptions (order_id);

-- Enable RLS
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_redemptions ENABLE ROW LEVEL SECURITY;

-- Promotions RLS policies
CREATE POLICY "Admins can manage all promotions"
ON public.promotions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active promotions"
ON public.promotions FOR SELECT
USING (status = 'active');

-- Promotion redemptions RLS policies
CREATE POLICY "Admins can manage all redemptions"
ON public.promotion_redemptions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own redemptions"
ON public.promotion_redemptions FOR SELECT
USING (client_id = auth.uid() OR client_email = (SELECT email FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create their own redemptions"
ON public.promotion_redemptions FOR INSERT
WITH CHECK (client_id = auth.uid() OR client_email = (SELECT email FROM profiles WHERE user_id = auth.uid()));

-- Trigger to update updated_at
CREATE TRIGGER update_promotions_updated_at
BEFORE UPDATE ON public.promotions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add promo fields to orders table for snapshot
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS promo_code TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS promo_discount_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS promo_details JSONB DEFAULT NULL;