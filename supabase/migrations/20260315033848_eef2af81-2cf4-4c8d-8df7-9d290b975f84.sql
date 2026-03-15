
-- Step 1: Add all new columns to services table
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS badges jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS features_json jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS visible_website boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS visible_simulator boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS visible_checkout boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS visible_portal boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_recommended boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_eligible boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS equipment_rules jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS activation_fee_rule text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS installation_fee_rule text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS shipping_fee_rule text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS updated_by_id uuid,
  ADD COLUMN IF NOT EXISTS updated_by_name text;
