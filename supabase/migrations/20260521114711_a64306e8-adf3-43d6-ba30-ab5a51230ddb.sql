
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  campaign_type TEXT CHECK (campaign_type IN ('promotion','upsell','retention','seasonal','reactivation','loyalty')),
  target_segment TEXT CHECK (target_segment IN ('all_active','internet_only','no_tv','high_value','at_risk','no_mobile','churned_90days','new_30days','long_term_1year')),
  subject_fr TEXT NOT NULL,
  subject_en TEXT,
  body_fr TEXT NOT NULL,
  body_en TEXT,
  offer_type TEXT CHECK (offer_type IN ('discount_percent','discount_fixed','free_month','upgrade','bundle','referral_bonus','loyalty_reward')),
  offer_value DECIMAL(10,2),
  offer_valid_days INTEGER DEFAULT 7,
  promo_code TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','scheduled','running','completed','paused')),
  scheduled_at TIMESTAMPTZ,
  sent_count INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  revenue_generated DECIMAL(10,2) DEFAULT 0,
  created_by UUID,
  ai_generated BOOLEAN DEFAULT false,
  ai_personalization_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON public.marketing_campaigns(status, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_created ON public.marketing_campaigns(created_at DESC);
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read marketing_campaigns" ON public.marketing_campaigns FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert marketing_campaigns" ON public.marketing_campaigns FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update marketing_campaigns" ON public.marketing_campaigns FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.campaign_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  account_id UUID,
  email TEXT NOT NULL,
  client_name TEXT,
  personalization_vars JSONB,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued','sent','opened','clicked','converted','unsubscribed','failed')),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign ON public.campaign_sends(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_account ON public.campaign_sends(account_id);
ALTER TABLE public.campaign_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read campaign_sends" ON public.campaign_sends FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.retention_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID,
  risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100),
  risk_factors JSONB,
  action_type TEXT CHECK (action_type IN ('email_offer','discount_offer','upgrade_offer','personal_outreach','winback_campaign')),
  offer_details JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','accepted','declined','expired')),
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  outcome TEXT,
  revenue_saved DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_retention_actions_account ON public.retention_actions(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retention_actions_score ON public.retention_actions(risk_score DESC);
ALTER TABLE public.retention_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read retention_actions" ON public.retention_actions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
