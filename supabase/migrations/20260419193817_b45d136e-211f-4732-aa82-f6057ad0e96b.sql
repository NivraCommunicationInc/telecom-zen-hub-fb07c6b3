ALTER TABLE public.phone_inventory 
ADD COLUMN IF NOT EXISTS available_colors TEXT[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS available_storage TEXT[] NOT NULL DEFAULT '{}';