-- Create TV channels table
CREATE TABLE public.tv_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('basic', 'premium', 'bundle')),
  price NUMERIC DEFAULT 0,
  description TEXT,
  is_hd BOOLEAN DEFAULT false,
  is_4k BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create channel selections table
CREATE TABLE public.channel_selections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  channels JSONB NOT NULL DEFAULT '[]',
  total_price NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  confirmed_by UUID,
  notes TEXT,
  related_ticket_id UUID REFERENCES public.support_tickets(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tv_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_selections ENABLE ROW LEVEL SECURITY;

-- TV Channels policies (public read for active, admin manage)
CREATE POLICY "Anyone can view active channels" ON public.tv_channels
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage channels" ON public.tv_channels
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Channel selections policies
CREATE POLICY "Users can view their own selections" ON public.channel_selections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own selections" ON public.channel_selections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all selections" ON public.channel_selections
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_channel_selections_updated_at
  BEFORE UPDATE ON public.channel_selections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert all channels
INSERT INTO public.tv_channels (name, category, price, is_hd, description) VALUES
-- Basic Channels (Included - $0)
('26 HD Canadian TV Channels', 'basic', 0, true, 'General Canadian TV channels package'),
('Pay-Per-View Sports Access', 'basic', 0, false, 'Access to PPV sporting events'),

-- Premium Channels ($10-$15 each)
('AMI TV English', 'premium', 10, false, 'Accessible Media Inc. English'),
('AMI TV French', 'premium', 10, false, 'Accessible Media Inc. French'),
('APTN HD', 'premium', 12, true, 'Aboriginal Peoples Television Network'),
('A&E', 'premium', 10, false, 'Arts & Entertainment'),
('BBC Earth', 'premium', 12, false, 'Nature and science documentaries'),
('BBC News', 'premium', 10, false, 'International news'),
('BNN Bloomberg', 'premium', 12, false, 'Business news'),
('BNN Bloomberg HD', 'premium', 14, true, 'Business news HD'),
('CBC Montreal', 'premium', 10, false, 'CBC Montreal'),
('CBC Ottawa', 'premium', 10, false, 'CBC Ottawa'),
('CBC News Network', 'premium', 12, false, 'CBC 24-hour news'),
('CHCH-11', 'premium', 10, false, 'Hamilton independent'),
('Citytv Montreal', 'premium', 10, false, 'Citytv Montreal'),
('Citytv Toronto', 'premium', 10, false, 'Citytv Toronto'),
('Casa', 'premium', 10, false, 'Home and lifestyle'),
('Canal D', 'premium', 10, false, 'French documentary'),
('Canal Vie', 'premium', 10, false, 'French lifestyle'),
('Canal M', 'premium', 10, false, 'Radio de Vues & Voix'),
('Cartoon Network / Disney Channel Bundle', 'premium', 15, false, 'Kids entertainment bundle'),
('Crime + Investigation', 'premium', 10, false, 'True crime content'),
('CMT Canada', 'premium', 10, false, 'Country music television'),
('CMT Canada HD', 'premium', 12, true, 'Country music television HD'),
('CNBC', 'premium', 10, false, 'Business news US'),
('CNN', 'premium', 12, false, 'US news network'),
('CTV Montreal', 'premium', 10, false, 'CTV Montreal'),
('CTV Ottawa', 'premium', 10, false, 'CTV Ottawa'),
('CTV Comedy', 'premium', 10, false, 'Comedy programming'),
('CTV Drama', 'premium', 10, false, 'Drama programming'),
('CTV Life', 'premium', 10, false, 'Lifestyle programming'),
('CTV Sci-Fi', 'premium', 10, false, 'Science fiction'),
('CTV Wild HD', 'premium', 12, true, 'Nature HD'),
('CTV Wild 4K', 'premium', 15, true, 'Nature 4K'),
('CTV News Channel', 'premium', 12, false, '24-hour news'),
('Documentary Channel', 'premium', 10, false, 'Documentaries'),
('Oxygen True Crime', 'premium', 10, false, 'True crime'),
('EuroNews', 'premium', 10, false, 'European news'),
('Évasion', 'premium', 10, false, 'French travel'),
('E!', 'premium', 10, false, 'Entertainment news'),
('Flavour Network', 'premium', 10, false, 'Food and cooking'),
('Fox News', 'premium', 12, false, 'US news'),
('Fox Sports Racing', 'premium', 12, false, 'Racing sports'),
('Fox Sports Racing HD', 'premium', 14, true, 'Racing sports HD'),
('Global Montreal', 'premium', 10, false, 'Global Montreal'),
('Global Toronto', 'premium', 10, false, 'Global Toronto'),
('GSN Game Show Network', 'premium', 10, false, 'Game shows'),
('Historia', 'premium', 10, false, 'French history'),
('History', 'premium', 10, false, 'History channel'),
('History2', 'premium', 10, false, 'History channel 2'),
('HLN', 'premium', 10, false, 'Headline News'),
('ICI ARTV', 'premium', 10, false, 'French arts'),
('ICI EXPLORA', 'premium', 10, false, 'French science'),
('ICI RDI', 'premium', 10, false, 'French news'),
('ICI RDI HD', 'premium', 12, true, 'French news HD'),
('Investigation', 'premium', 10, false, 'Investigation content'),
('LCN', 'premium', 10, false, 'French news'),
('Lifetime', 'premium', 10, false, 'Women programming'),
('Love Nature HD/4K', 'premium', 15, true, 'Nature bundle'),
('M6 International', 'premium', 12, false, 'French international'),
('Max', 'premium', 15, false, 'HBO Max content'),
('MovieTime', 'premium', 10, false, 'Classic movies'),
('Much', 'premium', 10, false, 'Music and pop culture'),
('MS Now', 'premium', 10, false, 'Makeful'),
('MS Now HD', 'premium', 12, true, 'Makeful HD'),
('Nat Geo Wild', 'premium', 12, false, 'Wildlife'),
('National Geographic', 'premium', 12, false, 'Documentary'),
('NBC Detroit', 'premium', 10, false, 'NBC Detroit'),
('NBC Plattsburgh', 'premium', 10, false, 'NBC Plattsburgh'),
('PBS Plattsburgh', 'premium', 10, false, 'PBS Plattsburgh'),
('PBS Vermont', 'premium', 10, false, 'PBS Vermont'),
('PBS Watertown', 'premium', 10, false, 'PBS Watertown'),
('PBS Watertown HD', 'premium', 12, true, 'PBS Watertown HD'),
('Prise 2', 'premium', 10, false, 'French classics'),
('RDS Bundle (RDS 1 + RDS 2)', 'premium', 15, false, 'French sports bundle'),
('RDS Info', 'premium', 10, false, 'French sports news'),
('RDS Info HD', 'premium', 12, true, 'French sports news HD'),
('Rewind', 'premium', 10, false, 'Classic content'),
('Saint-Pierre et Miquelon 1ère', 'premium', 10, false, 'French overseas'),
('Saisons', 'premium', 10, false, 'Outdoor lifestyle'),
('Series Plus', 'premium', 10, false, 'French series'),
('Showcase', 'premium', 10, false, 'Drama and action'),
('Silver Screen Classics', 'premium', 10, false, 'Classic movies'),
('Slice', 'premium', 10, false, 'Reality TV'),
('Sportsnet Bundle', 'premium', 15, true, 'All Sportsnet channels'),
('Sportsnet 360', 'premium', 12, false, 'Sports 360'),
('Sportsman Channel', 'premium', 10, false, 'Outdoor sports'),
('Stingray Retro', 'premium', 8, false, 'Retro music'),
('Stingray Vibe', 'premium', 8, false, 'Urban music'),
('Stingray Pop', 'premium', 8, false, 'Pop music'),
('Stingray Classica', 'premium', 8, false, 'Classical music'),
('Stingray Vibe HD', 'premium', 10, true, 'Urban music HD'),
('Super Channel', 'premium', 15, false, 'Movies and series'),
('Super Channel HD', 'premium', 18, true, 'Movies and series HD'),
('Superstations', 'premium', 10, false, 'US superstations'),
('Superstations HD', 'premium', 12, true, 'US superstations HD'),
('The Fight Network', 'premium', 12, false, 'Combat sports'),
('The Golf Channel', 'premium', 12, false, 'Golf programming'),
('The News Forum', 'premium', 10, false, 'News discussion'),
('The Weather Network', 'premium', 8, false, 'Weather'),
('The Sports Network', 'premium', 12, false, 'Sports'),
('Tele Niños', 'premium', 10, false, 'Spanish kids'),
('TFO', 'premium', 10, false, 'French Ontario'),
('Télé-Québec', 'premium', 10, false, 'Quebec public TV'),
('TéléMag', 'premium', 10, false, 'French magazine'),
('Télétoon', 'premium', 10, false, 'French cartoons'),
('Télétoon HD', 'premium', 12, true, 'French cartoons HD'),
('T+E', 'premium', 10, false, 'Travel and escape'),
('Treehouse', 'premium', 10, false, 'Preschool'),
('TSN Bundle (TSN1-5 + 4K)', 'premium', 15, true, 'All TSN channels'),
('TVA', 'premium', 10, false, 'TVA Quebec'),
('TVA HD', 'premium', 12, true, 'TVA Quebec HD'),
('TVA Sports', 'premium', 12, false, 'French sports'),
('TV5', 'premium', 10, false, 'French international'),
('TLC', 'premium', 10, false, 'Lifestyle'),
('TLN', 'premium', 10, false, 'Italian'),
('TVO Ontario', 'premium', 10, false, 'Ontario public'),
('USA Network', 'premium', 10, false, 'US entertainment'),
('Univision Canada', 'premium', 10, false, 'Spanish'),
('Vision TV', 'premium', 10, false, 'Multicultural'),
('Vision TV HD', 'premium', 12, true, 'Multicultural HD'),
('Wild TV', 'premium', 10, false, 'Outdoor lifestyle'),
('W Network', 'premium', 10, false, 'Women lifestyle'),
('Yes TV', 'premium', 10, false, 'Family'),
('YTV', 'premium', 10, false, 'Youth television'),
('YTV HD', 'premium', 12, true, 'Youth television HD'),
('Zeste', 'premium', 10, false, 'French food'),
('Zeste HD', 'premium', 12, true, 'French food HD'),
('Uvagut TV', 'premium', 10, false, 'Inuit television'),
('CBS Burlington', 'premium', 10, false, 'CBS Burlington'),
('ABC Burlington', 'premium', 10, false, 'ABC Burlington'),

-- Premium Bundles
('BeIN Sports Package', 'bundle', 15, false, 'International sports bundle'),
('Crave', 'bundle', 15, false, 'HBO and Showtime content'),
('Super Écran Bundle', 'bundle', 15, true, 'French premium movies'),
('Three RAI Channels', 'bundle', 12, false, 'Italian RAI channels'),
('ART America', 'bundle', 12, false, 'Arabic entertainment'),
('Alpha Sat', 'bundle', 10, false, 'Greek satellite'),
('Alpha Sat HD', 'bundle', 12, true, 'Greek satellite HD'),
('CCTV Entertainment', 'bundle', 10, false, 'Chinese entertainment'),
('CCTV-4', 'bundle', 10, false, 'Chinese news'),
('CCTV-4 HD', 'bundle', 12, true, 'Chinese news HD'),
('Cinelatino', 'bundle', 12, false, 'Spanish movies'),
('Caracol TV', 'bundle', 10, false, 'Colombian TV'),
('Playboy TV', 'bundle', 15, false, 'Adult content');