-- Add base_pack column to tv_channels to identify official channel packs
ALTER TABLE public.tv_channels ADD COLUMN IF NOT EXISTS base_pack text DEFAULT NULL;

-- Update the official 23 "La Base" channels with the LA_BASE_23 pack
UPDATE public.tv_channels SET base_pack = 'LA_BASE_23' WHERE name IN (
  'AMI TV',
  'Ami-Télé',
  'APTN HD',
  'APTN Langues',
  'CBC - Montréal',
  'CBC - Ottawa',
  'CBC NEWS NETWORK',
  'Citytv - Montréal',
  'CPAC',
  'CTV - Montréal',
  'CTV - Ottawa',
  'Global - Montréal',
  'Global - Toronto',
  'ICI RADIO-CANADA TÉLÉ',
  'Noovo',
  'OMNI. 2',
  'Télé-Québec',
  'TV5',
  'TVA',
  'Unis TV',
  'MétéoMédia HD',
  'Savoir média',
  'Yes TV'
) AND category = 'base';

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_tv_channels_base_pack ON public.tv_channels(base_pack) WHERE base_pack IS NOT NULL;