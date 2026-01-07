
-- =====================================================
-- SITE MANAGEMENT TABLES
-- =====================================================

-- Site Settings (global configuration)
CREATE TABLE public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value_text TEXT,
  value_json JSONB,
  description TEXT,
  category TEXT DEFAULT 'general',
  is_public BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by_id UUID,
  updated_by_name TEXT,
  updated_by_role TEXT
);

-- Site Pages (CMS-style content pages)
CREATE TABLE public.site_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title_fr TEXT NOT NULL,
  title_en TEXT,
  body_fr TEXT,
  body_en TEXT,
  meta_description_fr TEXT,
  meta_description_en TEXT,
  is_published BOOLEAN DEFAULT false,
  publish_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID,
  created_by_name TEXT,
  updated_by_id UUID,
  updated_by_name TEXT,
  updated_by_role TEXT
);

-- Site Offers (plans, pricing, promos)
CREATE TABLE public.site_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_type TEXT NOT NULL CHECK (offer_type IN ('plan', 'promo', 'addon', 'bundle')),
  category TEXT NOT NULL CHECK (category IN ('internet', 'tv', 'mobile', 'streaming', 'security', 'bundle')),
  name_fr TEXT NOT NULL,
  name_en TEXT,
  description_fr TEXT,
  description_en TEXT,
  price_monthly NUMERIC(10,2),
  price_setup NUMERIC(10,2) DEFAULT 0,
  discount_percent NUMERIC(5,2),
  discount_amount NUMERIC(10,2),
  promo_code TEXT,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  features_json JSONB DEFAULT '[]'::jsonb,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by_id UUID,
  created_by_name TEXT,
  updated_by_id UUID,
  updated_by_name TEXT,
  updated_by_role TEXT
);

-- =====================================================
-- 2FA / OTP TABLE
-- =====================================================

CREATE TABLE public.staff_otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add 2FA enforcement columns to user_roles
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS otp_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS otp_required BOOLEAN DEFAULT true;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_otp_codes ENABLE ROW LEVEL SECURITY;

-- Site Settings: Public can read public settings, staff can manage all
CREATE POLICY "Public can read public settings" ON public.site_settings
FOR SELECT USING (is_public = true);

CREATE POLICY "Staff can manage all settings" ON public.site_settings
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

-- Site Pages: Public can read published, staff can manage all
CREATE POLICY "Public can read published pages" ON public.site_pages
FOR SELECT USING (is_published = true AND (publish_at IS NULL OR publish_at <= now()));

CREATE POLICY "Staff can manage all pages" ON public.site_pages
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

-- Site Offers: Public can read active, staff can manage all
CREATE POLICY "Public can read active offers" ON public.site_offers
FOR SELECT USING (is_active = true AND (valid_from IS NULL OR valid_from <= now()) AND (valid_until IS NULL OR valid_until >= now()));

CREATE POLICY "Staff can manage all offers" ON public.site_offers
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

-- Staff OTP: Only own codes or staff managing
CREATE POLICY "Users can read own OTP" ON public.staff_otp_codes
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "System can insert OTP" ON public.staff_otp_codes
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update own OTP" ON public.staff_otp_codes
FOR UPDATE TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- AUDIT LOG FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_activity_log(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_before_data JSONB DEFAULT NULL,
  p_after_data JSONB DEFAULT NULL,
  p_summary TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_user_name TEXT;
  v_log_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Get user role and name
  SELECT ur.role, p.full_name 
  INTO v_user_role, v_user_name
  FROM user_roles ur
  LEFT JOIN profiles p ON p.user_id = ur.user_id
  WHERE ur.user_id = v_user_id
  LIMIT 1;
  
  -- Insert activity log
  INSERT INTO client_activity_logs (
    action_type,
    entity_type,
    entity_id,
    before_data,
    after_data,
    summary,
    actor_user_id,
    actor_role,
    actor_name,
    client_id
  ) VALUES (
    p_action,
    p_entity_type,
    p_entity_id,
    p_before_data,
    p_after_data,
    COALESCE(p_summary, p_action || ' on ' || p_entity_type),
    v_user_id,
    v_user_role,
    v_user_name,
    v_user_id
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- =====================================================
-- INSERT DEFAULT SITE SETTINGS
-- =====================================================

INSERT INTO public.site_settings (key, value_text, description, category, is_public) VALUES
('support_email', 'support@nivratelecom.ca', 'Support email address', 'contact', true),
('support_phone', '1-888-XXX-XXXX', 'Support phone number', 'contact', true),
('business_hours', '9h-17h, Lun-Ven', 'Business hours', 'contact', true),
('address', '123 Rue Example, Montréal, QC', 'Business address', 'contact', true),
('outage_banner_enabled', 'false', 'Show outage banner on site', 'alerts', true),
('outage_banner_message_fr', '', 'Outage banner message (French)', 'alerts', true),
('outage_banner_message_en', '', 'Outage banner message (English)', 'alerts', true),
('maintenance_mode', 'false', 'Enable maintenance mode', 'system', false)
ON CONFLICT (key) DO NOTHING;
