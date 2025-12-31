-- First clear all existing channel data
DELETE FROM tv_channels;

-- Drop the existing category check constraint
ALTER TABLE tv_channels DROP CONSTRAINT IF EXISTS tv_channels_category_check;

-- Add new constraint with updated categories
ALTER TABLE tv_channels ADD CONSTRAINT tv_channels_category_check 
  CHECK (category = ANY (ARRAY['base'::text, 'free_choice'::text, 'paid'::text]));