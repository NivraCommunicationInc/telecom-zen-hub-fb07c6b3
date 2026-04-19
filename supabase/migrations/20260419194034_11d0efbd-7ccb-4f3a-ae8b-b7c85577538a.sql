ALTER TABLE public.phone_orders 
ADD COLUMN IF NOT EXISTS selected_color TEXT,
ADD COLUMN IF NOT EXISTS selected_storage TEXT;