-- Drop and recreate the category check constraint to include 'premium'
ALTER TABLE public.tv_channels DROP CONSTRAINT IF EXISTS tv_channels_category_check;
ALTER TABLE public.tv_channels ADD CONSTRAINT tv_channels_category_check 
  CHECK (category = ANY (ARRAY['base'::text, 'free_choice'::text, 'paid'::text, 'premium'::text]));