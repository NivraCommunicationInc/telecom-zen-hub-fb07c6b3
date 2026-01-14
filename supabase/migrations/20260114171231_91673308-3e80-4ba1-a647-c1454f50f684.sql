-- =====================================================
-- MODULE MARKETING EMAIL - STRUCTURE COMPLÈTE
-- =====================================================

-- 1. TEMPLATES EMAIL (HTML avec variables dynamiques)
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  preview_text TEXT,
  category TEXT DEFAULT 'general',
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. CAMPAGNES EMAIL (manuelles et automatisées)
CREATE TABLE public.email_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  campaign_number TEXT UNIQUE,
  template_id UUID REFERENCES public.email_templates(id),
  subject_override TEXT,
  type TEXT NOT NULL DEFAULT 'manual' CHECK (type IN ('manual', 'automated', 'triggered')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled')),
  
  -- Segmentation
  segment_filters JSONB DEFAULT '{}'::jsonb,
  
  -- Planification
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Stats agrégées
  total_recipients INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  total_unsubscribed INTEGER DEFAULT 0,
  
  -- Metadata
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. RÈGLES D'AUTOMATISATION (triggers)
CREATE TABLE public.email_automation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'welcome', 'anniversary', 'birthday', 
    'payment_overdue', 'payment_received',
    'service_activated', 'service_cancelled',
    'order_completed', 'order_shipped',
    'inactivity', 'custom'
  )),
  
  -- Configuration du trigger
  trigger_config JSONB DEFAULT '{}'::jsonb,
  delay_minutes INTEGER DEFAULT 0,
  
  -- Template à utiliser
  template_id UUID REFERENCES public.email_templates(id),
  subject_override TEXT,
  
  -- Segmentation
  segment_filters JSONB DEFAULT '{}'::jsonb,
  
  -- État
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  
  -- Stats
  total_triggered INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. ENVOIS EMAIL (historique détaillé)
CREATE TABLE public.email_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Références
  campaign_id UUID REFERENCES public.email_campaigns(id),
  automation_rule_id UUID REFERENCES public.email_automation_rules(id),
  template_id UUID REFERENCES public.email_templates(id),
  client_id UUID NOT NULL,
  
  -- Contenu envoyé
  to_email TEXT NOT NULL,
  to_name TEXT,
  subject TEXT NOT NULL,
  
  -- Tracking
  resend_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed')),
  
  -- Events
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  
  -- Metadata
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  click_urls JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. DÉSABONNEMENTS (conformité LCAP/CASL)
CREATE TABLE public.email_unsubscribes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  email TEXT NOT NULL,
  reason TEXT,
  unsubscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resubscribed_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  source TEXT DEFAULT 'user_request',
  UNIQUE(email)
);

-- 6. PRÉFÉRENCES EMAIL CLIENT
CREATE TABLE public.client_email_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL UNIQUE,
  marketing_emails BOOLEAN DEFAULT true,
  promotional_emails BOOLEAN DEFAULT true,
  newsletter BOOLEAN DEFAULT true,
  service_updates BOOLEAN DEFAULT true,
  billing_notifications BOOLEAN DEFAULT true,
  consent_given_at TIMESTAMPTZ,
  consent_source TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- INDEXES POUR PERFORMANCE
-- =====================================================
CREATE INDEX idx_email_templates_category ON public.email_templates(category);
CREATE INDEX idx_email_templates_active ON public.email_templates(is_active);

CREATE INDEX idx_email_campaigns_status ON public.email_campaigns(status);
CREATE INDEX idx_email_campaigns_type ON public.email_campaigns(type);
CREATE INDEX idx_email_campaigns_scheduled ON public.email_campaigns(scheduled_at);

CREATE INDEX idx_email_automation_rules_trigger ON public.email_automation_rules(trigger_type);
CREATE INDEX idx_email_automation_rules_active ON public.email_automation_rules(is_active);

CREATE INDEX idx_email_sends_campaign ON public.email_sends(campaign_id);
CREATE INDEX idx_email_sends_automation ON public.email_sends(automation_rule_id);
CREATE INDEX idx_email_sends_client ON public.email_sends(client_id);
CREATE INDEX idx_email_sends_status ON public.email_sends(status);
CREATE INDEX idx_email_sends_created ON public.email_sends(created_at);

CREATE INDEX idx_email_unsubscribes_email ON public.email_unsubscribes(email);
CREATE INDEX idx_email_unsubscribes_active ON public.email_unsubscribes(is_active);

-- =====================================================
-- TRIGGERS POUR UPDATED_AT
-- =====================================================
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_campaigns_updated_at
  BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_automation_rules_updated_at
  BEFORE UPDATE ON public.email_automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- GÉNÉRATION NUMÉRO DE CAMPAGNE
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_campaign_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.campaign_number IS NULL THEN
    NEW.campaign_number := 'CAMP-' || to_char(now(), 'YYYYMMDD') || '-' || 
      LPAD(COALESCE(
        (SELECT COUNT(*) + 1 FROM public.email_campaigns 
         WHERE created_at::date = CURRENT_DATE)::text, '1'
      ), 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_campaign_number_trigger
  BEFORE INSERT ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.generate_campaign_number();

-- =====================================================
-- RLS POLICIES (Admin seulement)
-- =====================================================
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_email_preferences ENABLE ROW LEVEL SECURITY;

-- Policies pour admin/employees
CREATE POLICY "Admin can manage email_templates"
  ON public.email_templates FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
    OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Admin can manage email_campaigns"
  ON public.email_campaigns FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
    OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Admin can manage email_automation_rules"
  ON public.email_automation_rules FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
    OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Admin can view email_sends"
  ON public.email_sends FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
    OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Admin can manage email_unsubscribes"
  ON public.email_unsubscribes FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
    OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Admin can manage client_email_preferences"
  ON public.client_email_preferences FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
    OR EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND is_active = true)
  );

-- Clients peuvent voir leurs propres préférences
CREATE POLICY "Clients can view own email_preferences"
  ON public.client_email_preferences FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "Clients can update own email_preferences"
  ON public.client_email_preferences FOR UPDATE
  USING (client_id = auth.uid());

-- =====================================================
-- TEMPLATES PAR DÉFAUT
-- =====================================================
INSERT INTO public.email_templates (name, slug, subject, html_content, category, variables) VALUES
('Bienvenue', 'welcome', 'Bienvenue chez Nivra Télécom, {{client_name}}!', 
'<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<div style="background: linear-gradient(135deg, #0d9488 0%, #0891b2 100%); padding: 40px 20px; text-align: center;">
<h1 style="color: white; margin: 0;">Bienvenue chez Nivra!</h1>
</div>
<div style="padding: 30px 20px;">
<p>Bonjour {{client_name}},</p>
<p>Nous sommes ravis de vous accueillir parmi nos clients!</p>
<p>Votre compte est maintenant actif et vous pouvez accéder à votre espace client.</p>
<a href="{{portal_link}}" style="display: inline-block; background: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Accéder à mon espace</a>
<p>À bientôt,<br>L''équipe Nivra Télécom</p>
</div>
</body></html>', 
'onboarding', '["client_name", "portal_link"]'::jsonb),

('Rappel de paiement', 'payment-reminder', 'Rappel: Facture {{invoice_number}} en attente', 
'<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<div style="background: #f59e0b; padding: 40px 20px; text-align: center;">
<h1 style="color: white; margin: 0;">Rappel de paiement</h1>
</div>
<div style="padding: 30px 20px;">
<p>Bonjour {{client_name}},</p>
<p>Votre facture <strong>{{invoice_number}}</strong> d''un montant de <strong>{{amount}}</strong> est en attente de paiement.</p>
<p>Date d''échéance: <strong>{{due_date}}</strong></p>
<a href="{{payment_link}}" style="display: inline-block; background: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Payer maintenant</a>
<p>Merci de votre confiance,<br>L''équipe Nivra Télécom</p>
</div>
</body></html>', 
'billing', '["client_name", "invoice_number", "amount", "due_date", "payment_link"]'::jsonb),

('Service activé', 'service-activated', 'Votre service {{service_type}} est maintenant actif!', 
'<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<div style="background: linear-gradient(135deg, #10b981 0%, #0d9488 100%); padding: 40px 20px; text-align: center;">
<h1 style="color: white; margin: 0;">Service activé!</h1>
</div>
<div style="padding: 30px 20px;">
<p>Bonjour {{client_name}},</p>
<p>Excellente nouvelle! Votre service <strong>{{service_type}}</strong> est maintenant actif.</p>
<p>Détails du service:</p>
<ul>
<li>Plan: {{plan_name}}</li>
<li>Date d''activation: {{activation_date}}</li>
</ul>
<a href="{{portal_link}}" style="display: inline-block; background: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Voir mes services</a>
<p>Profitez bien!<br>L''équipe Nivra Télécom</p>
</div>
</body></html>', 
'service', '["client_name", "service_type", "plan_name", "activation_date", "portal_link"]'::jsonb),

('Newsletter mensuelle', 'monthly-newsletter', 'Les nouvelles Nivra - {{month}} {{year}}', 
'<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<div style="background: linear-gradient(135deg, #0d9488 0%, #0891b2 100%); padding: 40px 20px; text-align: center;">
<h1 style="color: white; margin: 0;">Newsletter {{month}}</h1>
</div>
<div style="padding: 30px 20px;">
<p>Bonjour {{client_name}},</p>
{{content}}
<p>À bientôt,<br>L''équipe Nivra Télécom</p>
</div>
<div style="background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280;">
<a href="{{unsubscribe_link}}" style="color: #6b7280;">Se désabonner</a>
</div>
</body></html>', 
'newsletter', '["client_name", "month", "year", "content", "unsubscribe_link"]'::jsonb);

-- =====================================================
-- RÈGLES D'AUTOMATISATION PAR DÉFAUT
-- =====================================================
INSERT INTO public.email_automation_rules (name, description, trigger_type, template_id, delay_minutes, is_active) 
SELECT 
  'Bienvenue nouveau client',
  'Email envoyé automatiquement après création d''un compte client',
  'welcome',
  id,
  0,
  true
FROM public.email_templates WHERE slug = 'welcome';

INSERT INTO public.email_automation_rules (name, description, trigger_type, template_id, delay_minutes, is_active)
SELECT 
  'Rappel facture en retard',
  'Email envoyé 3 jours après la date d''échéance',
  'payment_overdue',
  id,
  4320, -- 3 jours
  true
FROM public.email_templates WHERE slug = 'payment-reminder';

INSERT INTO public.email_automation_rules (name, description, trigger_type, template_id, delay_minutes, is_active)
SELECT 
  'Confirmation activation service',
  'Email envoyé immédiatement après activation d''un service',
  'service_activated',
  id,
  0,
  true
FROM public.email_templates WHERE slug = 'service-activated';