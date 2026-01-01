-- Add service-specific status tracking
CREATE TABLE public.service_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name TEXT NOT NULL UNIQUE, -- 'internet', 'tv', 'mobile', 'streaming', 'portal', 'billing'
  display_name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'operational', -- 'operational', 'degraded', 'partial_outage', 'major_outage', 'maintenance'
  status_message TEXT,
  last_incident_at TIMESTAMP WITH TIME ZONE,
  uptime_percent NUMERIC DEFAULT 100.00,
  response_time_ms INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

-- Enable RLS
ALTER TABLE public.service_status ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view service status
CREATE POLICY "Anyone can view service status"
ON public.service_status
FOR SELECT
USING (true);

-- Only admins can manage service status
CREATE POLICY "Admins can manage service status"
ON public.service_status
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_service_status_updated_at
  BEFORE UPDATE ON public.service_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default services
INSERT INTO public.service_status (service_name, display_name, description, status) VALUES
('internet', 'Internet Résidentiel', 'Services Internet fibre et câble', 'operational'),
('tv', 'Télévision IPTV', 'Services de télévision et chaînes', 'operational'),
('mobile', 'Réseau Mobile', 'Services cellulaires et données mobiles', 'operational'),
('streaming', 'Streaming+', 'Services de streaming vidéo et audio', 'operational'),
('portal', 'Portail Client', 'Accès au portail et compte client', 'operational'),
('billing', 'Facturation', 'Système de paiement et facturation', 'operational');