-- Create streaming_services table for available streaming options
CREATE TABLE public.streaming_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  monthly_price NUMERIC NOT NULL DEFAULT 0,
  category TEXT DEFAULT 'streaming',
  is_active BOOLEAN DEFAULT true,
  features JSONB DEFAULT '[]'::jsonb,
  private_notes TEXT, -- Admin-only notes
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create client_streaming_subscriptions table for client subscriptions
CREATE TABLE public.client_streaming_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  streaming_service_id UUID NOT NULL REFERENCES public.streaming_services(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  monthly_price NUMERIC,
  discount_amount NUMERIC DEFAULT 0,
  promo_code TEXT,
  internal_notes TEXT, -- Admin-only internal notes
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, streaming_service_id, account_id)
);

-- Enable RLS
ALTER TABLE public.streaming_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_streaming_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS for streaming_services
CREATE POLICY "Anyone can view active streaming services"
ON public.streaming_services
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage all streaming services"
ON public.streaming_services
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view all streaming services"
ON public.streaming_services
FOR SELECT
USING (has_role(auth.uid(), 'employee'::app_role));

-- RLS for client_streaming_subscriptions
CREATE POLICY "Admins can manage all subscriptions"
ON public.client_streaming_subscriptions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view all subscriptions"
ON public.client_streaming_subscriptions
FOR SELECT
USING (has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Employees can create subscriptions"
ON public.client_streaming_subscriptions
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Clients can view their own subscriptions"
ON public.client_streaming_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_streaming_services_updated_at
  BEFORE UPDATE ON public.streaming_services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_streaming_subscriptions_updated_at
  BEFORE UPDATE ON public.client_streaming_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample streaming services
INSERT INTO public.streaming_services (name, description, monthly_price, category, features) VALUES
('Netflix Premium', 'Streaming HD/4K illimité', 22.99, 'video', '["4K Ultra HD", "4 écrans simultanés", "Téléchargements illimités"]'),
('Disney+ Standard', 'Disney, Marvel, Star Wars, Pixar', 11.99, 'video', '["Full HD", "4 écrans simultanés", "GroupWatch"]'),
('Spotify Premium', 'Musique sans publicité', 10.99, 'music', '["Sans publicité", "Téléchargement hors ligne", "Qualité audio supérieure"]'),
('Amazon Prime Video', 'Films et séries Amazon', 9.99, 'video', '["4K Ultra HD", "3 écrans simultanés", "X-Ray"]'),
('Apple TV+', 'Contenu original Apple', 8.99, 'video', '["4K HDR", "6 écrans simultanés", "Apple Originals"]'),
('Crave + HBO', 'HBO, Showtime et plus', 19.99, 'video', '["HBO Originals", "Showtime", "Contenu canadien"]');