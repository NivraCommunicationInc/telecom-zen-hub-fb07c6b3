
-- ============================================================
-- MARKETING HUB — Mailchimp-like tables (admin-only)
-- ============================================================

-- 1. Audiences (segments dynamiques)
CREATE TABLE IF NOT EXISTS public.mkt_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  rules JSONB NOT NULL DEFAULT '{"all":[]}'::jsonb,
  member_count INTEGER NOT NULL DEFAULT 0,
  last_refreshed_at TIMESTAMPTZ,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_audiences TO authenticated;
GRANT ALL ON public.mkt_audiences TO service_role;
ALTER TABLE public.mkt_audiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mkt_audiences_admin_all" ON public.mkt_audiences FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- 2. Contacts custom (imports CSV hors CRM)
CREATE TABLE IF NOT EXISTS public.mkt_contacts_custom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  city TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'csv_import',
  import_id UUID,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mkt_contacts_custom_email_idx
  ON public.mkt_contacts_custom (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS mkt_contacts_custom_tags_idx ON public.mkt_contacts_custom USING GIN (tags);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_contacts_custom TO authenticated;
GRANT ALL ON public.mkt_contacts_custom TO service_role;
ALTER TABLE public.mkt_contacts_custom ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mkt_contacts_custom_admin_all" ON public.mkt_contacts_custom FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- 3. Imports CSV
CREATE TABLE IF NOT EXISTS public.mkt_contacts_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] NOT NULL DEFAULT '{}',
  mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_contacts_imports TO authenticated;
GRANT ALL ON public.mkt_contacts_imports TO service_role;
ALTER TABLE public.mkt_contacts_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mkt_contacts_imports_admin_all" ON public.mkt_contacts_imports FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- 4. Templates
CREATE TABLE IF NOT EXISTS public.mkt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  design JSONB NOT NULL DEFAULT '{"blocks":[]}'::jsonb,
  html TEXT,
  thumbnail_url TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_templates TO authenticated;
GRANT ALL ON public.mkt_templates TO service_role;
ALTER TABLE public.mkt_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mkt_templates_admin_all" ON public.mkt_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- 5. Campagnes
CREATE TABLE IF NOT EXISTS public.mkt_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email','push')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','paused','failed')),
  audience_id UUID REFERENCES public.mkt_audiences(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.mkt_templates(id) ON DELETE SET NULL,
  subject TEXT,
  preheader TEXT,
  from_name TEXT NOT NULL DEFAULT 'Nivra',
  from_email TEXT NOT NULL DEFAULT 'marketing@notify.nivra-telecom.ca',
  reply_to TEXT,
  html_content TEXT,
  text_content TEXT,
  ab_config JSONB,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  opened_count INTEGER NOT NULL DEFAULT 0,
  clicked_count INTEGER NOT NULL DEFAULT 0,
  bounced_count INTEGER NOT NULL DEFAULT 0,
  complained_count INTEGER NOT NULL DEFAULT 0,
  unsubscribed_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mkt_campaigns_status_idx ON public.mkt_campaigns(status);
CREATE INDEX IF NOT EXISTS mkt_campaigns_scheduled_idx ON public.mkt_campaigns(scheduled_at) WHERE status='scheduled';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_campaigns TO authenticated;
GRANT ALL ON public.mkt_campaigns TO service_role;
ALTER TABLE public.mkt_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mkt_campaigns_admin_all" ON public.mkt_campaigns FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- 6. Journal d'envoi unifié
CREATE TABLE IF NOT EXISTS public.mkt_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.mkt_campaigns(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'email',
  recipient_email TEXT,
  recipient_phone TEXT,
  crm_contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  client_id UUID,
  custom_contact_id UUID REFERENCES public.mkt_contacts_custom(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'resend',
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','delivered','opened','clicked','bounced','complained','failed','suppressed')),
  error TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  first_opened_at TIMESTAMPTZ,
  first_clicked_at TIMESTAMPTZ,
  open_count INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mkt_send_log_campaign_idx ON public.mkt_send_log(campaign_id);
CREATE INDEX IF NOT EXISTS mkt_send_log_provider_msg_idx ON public.mkt_send_log(provider_message_id);
CREATE INDEX IF NOT EXISTS mkt_send_log_status_idx ON public.mkt_send_log(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkt_send_log TO authenticated;
GRANT ALL ON public.mkt_send_log TO service_role;
ALTER TABLE public.mkt_send_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mkt_send_log_admin_read" ON public.mkt_send_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'));
CREATE POLICY "mkt_send_log_service_write" ON public.mkt_send_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 7. Webhook events audit
CREATE TABLE IF NOT EXISTS public.mkt_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'resend',
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mkt_webhook_events TO authenticated;
GRANT ALL ON public.mkt_webhook_events TO service_role;
ALTER TABLE public.mkt_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mkt_webhook_events_admin_read" ON public.mkt_webhook_events FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'));

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.mkt_touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['mkt_audiences','mkt_contacts_custom','mkt_templates','mkt_campaigns','mkt_send_log']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t||'_touch', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.mkt_touch_updated_at()', t||'_touch', t);
  END LOOP;
END $$;

-- Seed: audience "Tous les contacts CRM avec email"
INSERT INTO public.mkt_audiences (name, description, rules)
VALUES ('Tous les contacts CRM (avec email)', 'Prospects CRM avec email + consentement marketing',
        '{"source":"crm_contacts","filters":{"has_email":true,"marketing_consent":true}}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO public.mkt_audiences (name, description, rules)
VALUES ('Tous les clients actifs', 'Clients Nivra avec compte actif et email',
        '{"source":"clients","filters":{"has_email":true,"active":true}}'::jsonb)
ON CONFLICT DO NOTHING;
