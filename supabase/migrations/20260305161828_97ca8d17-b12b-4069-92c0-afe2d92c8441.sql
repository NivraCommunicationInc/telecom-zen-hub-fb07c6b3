
ALTER TABLE public.service_addresses
  ADD COLUMN IF NOT EXISTS last_install_outcome TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_install_outcome_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS coax_readiness_score INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.service_addresses.last_install_outcome IS 'Outcome of last installation: success_l1, success_l2, fail_auto, fail_l1_upgrade_l2, no_coax_found';
