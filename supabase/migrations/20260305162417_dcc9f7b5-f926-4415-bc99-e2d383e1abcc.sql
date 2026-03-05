
ALTER TABLE public.service_addresses
  ADD COLUMN IF NOT EXISTS last_install_level TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_install_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.service_addresses.last_install_level IS 'Last technician level used: level_1, level_2, auto';
COMMENT ON COLUMN public.service_addresses.last_install_at IS 'Timestamp of last installation attempt';
