-- Create channel_packages table for theme packs/bundles
CREATE TABLE public.channel_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  channels JSONB NOT NULL DEFAULT '[]'::jsonb,
  original_price NUMERIC NOT NULL DEFAULT 0,
  discounted_price NUMERIC NOT NULL DEFAULT 0,
  savings_percent NUMERIC,
  is_active BOOLEAN DEFAULT true,
  category TEXT NOT NULL DEFAULT 'theme_pack',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.channel_packages ENABLE ROW LEVEL SECURITY;

-- Public can view active packages
CREATE POLICY "Anyone can view active packages" 
ON public.channel_packages 
FOR SELECT 
USING (is_active = true);

-- Admins can manage packages
CREATE POLICY "Admins can manage packages" 
ON public.channel_packages 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add update trigger
CREATE TRIGGER update_channel_packages_updated_at
  BEFORE UPDATE ON public.channel_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert theme packs with discounts
INSERT INTO public.channel_packages (name, description, channels, original_price, discounted_price, savings_percent, category) VALUES
-- Sports Pack
('Pack Sports Complet', 'Tous les sports en un seul forfait: TSN, Sportsnet, RDS et plus', 
 '[{"name": "TSN (1-5 + 4K)", "price": 15}, {"name": "Sportsnet (All regions + 4K)", "price": 15}, {"name": "RDS (RDS 1 + RDS 2)", "price": 12}, {"name": "RDS Info", "price": 10}, {"name": "The Sports Network", "price": 10}, {"name": "Sportsman Channel", "price": 10}]',
 72, 49.99, 31, 'sports'),

-- News Pack
('Pack Nouvelles 24/7', 'Restez informé avec toutes les chaînes d''actualités',
 '[{"name": "CBC News Network", "price": 10}, {"name": "CTV News Channel", "price": 10}, {"name": "ICI RDI", "price": 10}, {"name": "LCN", "price": 10}, {"name": "CNN", "price": 12}, {"name": "BBC News", "price": 12}, {"name": "Fox News", "price": 12}]',
 76, 54.99, 28, 'news'),

-- Family Pack
('Pack Famille', 'Divertissement pour toute la famille',
 '[{"name": "Disney Channel / Cartoon Network", "price": 15}, {"name": "YTV", "price": 10}, {"name": "Treehouse", "price": 10}, {"name": "Télétoon", "price": 10}, {"name": "TFO", "price": 10}, {"name": "Family", "price": 10}]',
 65, 44.99, 31, 'family'),

-- Movies Pack
('Pack Cinéma', 'Les meilleures chaînes de films et séries',
 '[{"name": "Crave", "price": 15}, {"name": "Super Écran", "price": 15}, {"name": "Max", "price": 15}, {"name": "Super Channel", "price": 12}, {"name": "MovieTime", "price": 10}, {"name": "Silver Screen Classics", "price": 10}]',
 77, 54.99, 29, 'movies'),

-- French Pack
('Pack Francophone', 'Le meilleur du contenu francophone',
 '[{"name": "TVA", "price": 10}, {"name": "Canal D", "price": 10}, {"name": "Canal Vie", "price": 10}, {"name": "Historia", "price": 10}, {"name": "Séries Plus", "price": 10}, {"name": "TV5", "price": 10}, {"name": "ICI ARTV", "price": 12}, {"name": "Télé-Québec", "price": 10}]',
 82, 59.99, 27, 'francophone'),

-- Discovery & Nature Pack
('Pack Découverte & Nature', 'Explorez le monde et la nature',
 '[{"name": "National Geographic", "price": 12}, {"name": "Nat Geo Wild", "price": 12}, {"name": "BBC Earth", "price": 12}, {"name": "Documentary Channel", "price": 10}, {"name": "Love Nature HD/4K", "price": 12}, {"name": "ICI EXPLORA", "price": 10}, {"name": "Évasion", "price": 10}]',
 78, 54.99, 29, 'nature'),

-- Music Pack
('Pack Musique', 'Chaînes musicales premium',
 '[{"name": "Stingray Retro", "price": 8}, {"name": "Stingray Vibe", "price": 8}, {"name": "Stingray Pop", "price": 8}, {"name": "Stingray Classica", "price": 8}, {"name": "Much", "price": 10}]',
 42, 29.99, 29, 'music'),

-- International Pack
('Pack International', 'Chaînes du monde entier',
 '[{"name": "Univision Canada", "price": 10}, {"name": "TLN", "price": 10}, {"name": "M6 International", "price": 12}, {"name": "EuroNews", "price": 10}, {"name": "CCTV-4", "price": 10}, {"name": "Three RAI Channels", "price": 15}]',
 67, 49.99, 25, 'international');

-- Add realtime for channel_packages
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_packages;