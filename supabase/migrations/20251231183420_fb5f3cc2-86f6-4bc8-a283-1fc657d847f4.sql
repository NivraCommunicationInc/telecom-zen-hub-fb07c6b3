-- Add selected_channels column to orders table to store channel selections
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS selected_channels JSONB DEFAULT '[]'::jsonb;

-- Add channel_selection_locked column to indicate if client can modify channels
-- (false = can modify, true = locked until installation complete for admin orders)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS channel_selection_locked BOOLEAN DEFAULT false;

-- Add channel_assigned_by column to track who assigned channels (admin vs client)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS channel_assigned_by TEXT DEFAULT NULL;