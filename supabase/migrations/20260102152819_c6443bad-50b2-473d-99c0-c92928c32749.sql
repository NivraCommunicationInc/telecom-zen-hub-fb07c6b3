-- Add group_key column for bundled channels (counts as 1 selection)
ALTER TABLE public.tv_channels ADD COLUMN IF NOT EXISTS group_key TEXT;

-- Add display_label column for bundled channel display name  
ALTER TABLE public.tv_channels ADD COLUMN IF NOT EXISTS display_label TEXT;

-- Create index for group_key lookups
CREATE INDEX IF NOT EXISTS idx_tv_channels_group_key ON public.tv_channels(group_key) WHERE group_key IS NOT NULL;