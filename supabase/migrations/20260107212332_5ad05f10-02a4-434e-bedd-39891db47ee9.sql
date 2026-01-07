-- =====================================================
-- FEATURE 2: Maintenance Mode Settings
-- =====================================================

-- Add maintenance mode settings to site_settings
INSERT INTO public.site_settings (key, value_json, description, category, is_public)
VALUES 
  ('maintenance_mode', '{"enabled": false, "eta": null, "message_fr": "Site en maintenance. Merci de votre patience.", "message_en": "Site under maintenance. Thank you for your patience."}', 'Global maintenance mode configuration', 'system', true),
  ('maintenance_allowed_routes', '{"routes": ["/", "/contact", "/aide", "/portal/auth"]}', 'Routes accessible during maintenance', 'system', false)
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- FEATURE 7: Security Guardian - Incidents Table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.security_incidents (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    incident_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    description TEXT,
    source TEXT,
    affected_entity_type TEXT,
    affected_entity_id TEXT,
    detection_method TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'mitigated', 'resolved', 'false_positive')),
    auto_mitigated BOOLEAN DEFAULT false,
    mitigation_action TEXT,
    mitigation_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by_id UUID,
    resolved_by_name TEXT,
    metadata JSONB DEFAULT '{}'
);

-- Index for security incidents
CREATE INDEX IF NOT EXISTS idx_security_incidents_type ON public.security_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_security_incidents_status ON public.security_incidents(status);
CREATE INDEX IF NOT EXISTS idx_security_incidents_severity ON public.security_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_security_incidents_created ON public.security_incidents(created_at DESC);

-- Enable RLS (admin only via service role)
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- FEATURE 6: Chatbot Logs
-- =====================================================

CREATE TABLE IF NOT EXISTS public.chatbot_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id UUID,
    is_authenticated BOOLEAN DEFAULT false,
    user_message TEXT NOT NULL,
    bot_response TEXT NOT NULL,
    intent_detected TEXT,
    entities_extracted JSONB DEFAULT '{}',
    actions_taken JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_logs_session ON public.chatbot_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_logs_user ON public.chatbot_logs(user_id);

-- Enable RLS
ALTER TABLE public.chatbot_logs ENABLE ROW LEVEL SECURITY;

-- Clients can view their own chatbot history
CREATE POLICY "Users can view their own chatbot logs"
    ON public.chatbot_logs FOR SELECT
    USING (auth.uid() = user_id);