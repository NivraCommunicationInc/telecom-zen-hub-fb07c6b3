
-- Day 4: TV Packs & Pack-Channel junction for relational management

-- 1. Add visibility fields to tv_channels
ALTER TABLE public.tv_channels
  ADD COLUMN IF NOT EXISTS visible_website boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS visible_simulator boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS genre text;

-- 2. Create canonical tv_packs table (replaces JSONB-based channel_packages)
CREATE TABLE IF NOT EXISTS public.tv_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  description text,
  category text NOT NULL DEFAULT 'thematic',
  original_price numeric(10,2) NOT NULL DEFAULT 0,
  discounted_price numeric(10,2) NOT NULL DEFAULT 0,
  savings_percent numeric(5,1),
  is_active boolean DEFAULT true,
  visible_website boolean DEFAULT true,
  visible_simulator boolean DEFAULT true,
  visible_checkout boolean DEFAULT true,
  display_order integer DEFAULT 0,
  badge text,
  icon text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tv_packs_active ON public.tv_packs(is_active);

ALTER TABLE public.tv_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active tv_packs"
  ON public.tv_packs FOR SELECT
  USING (true);

CREATE POLICY "Admin can manage tv_packs"
  ON public.tv_packs FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'employee'))
  );

-- 3. Create relational junction: tv_pack_channels
CREATE TABLE IF NOT EXISTS public.tv_pack_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.tv_packs(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.tv_channels(id) ON DELETE CASCADE,
  is_optional boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pack_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_tv_pack_channels_pack ON public.tv_pack_channels(pack_id);
CREATE INDEX IF NOT EXISTS idx_tv_pack_channels_channel ON public.tv_pack_channels(channel_id);

ALTER TABLE public.tv_pack_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read tv_pack_channels"
  ON public.tv_pack_channels FOR SELECT
  USING (true);

CREATE POLICY "Admin can manage tv_pack_channels"
  ON public.tv_pack_channels FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'employee'))
  );
