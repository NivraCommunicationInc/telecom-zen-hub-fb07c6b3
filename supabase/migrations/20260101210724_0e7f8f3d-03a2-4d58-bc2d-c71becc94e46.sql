-- Create system_status table for status messages and announcements
CREATE TABLE public.system_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status_type TEXT NOT NULL DEFAULT 'info', -- 'maintenance', 'incident', 'info', 'resolved', 'scheduled'
  severity TEXT NOT NULL DEFAULT 'info', -- 'critical', 'warning', 'info', 'success'
  is_active BOOLEAN DEFAULT true,
  is_banner BOOLEAN DEFAULT true, -- Show as banner at top of page
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  affected_services JSONB DEFAULT '[]'::jsonb, -- ['internet', 'tv', 'streaming', 'portal']
  show_to_clients BOOLEAN DEFAULT true,
  show_to_employees BOOLEAN DEFAULT true,
  show_to_technicians BOOLEAN DEFAULT true,
  internal_notes TEXT, -- Admin-only notes
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_status ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view active status messages
CREATE POLICY "Anyone can view active system status"
ON public.system_status
FOR SELECT
USING (is_active = true);

-- Only admins can manage system status
CREATE POLICY "Admins can manage all system status"
ON public.system_status
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_system_status_updated_at
  BEFORE UPDATE ON public.system_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert a welcome message
INSERT INTO public.system_status (title, message, status_type, severity, is_active, is_banner) 
VALUES ('Bienvenue', 'Tous les systèmes fonctionnent normalement.', 'info', 'success', false, true);