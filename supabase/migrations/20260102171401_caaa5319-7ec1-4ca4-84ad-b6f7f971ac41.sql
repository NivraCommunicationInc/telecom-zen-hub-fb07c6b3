-- Fix: allow clients to read TV channel catalog (non-PII)

-- 1) RLS: authenticated users (clients) can read active channels
DROP POLICY IF EXISTS "Clients can view active tv channels" ON public.tv_channels;
CREATE POLICY "Clients can view active tv channels"
ON public.tv_channels
FOR SELECT
TO authenticated
USING (is_active = true);

-- 2) Enforce strict base pack: LA_BASE_26 (exactly 26)
-- Convert previous pack LA_BASE_23 -> LA_BASE_26
UPDATE public.tv_channels
SET base_pack = 'LA_BASE_26'
WHERE base_pack = 'LA_BASE_23';

-- Add 3 more base channels to reach 26 total
UPDATE public.tv_channels
SET base_pack = 'LA_BASE_26'
WHERE is_active = true
  AND category = 'base'
  AND base_pack IS NULL
  AND name IN (
    'ICI Télévision',
    'CPAC anglais',
    'Assemblée Nationale'
  );
