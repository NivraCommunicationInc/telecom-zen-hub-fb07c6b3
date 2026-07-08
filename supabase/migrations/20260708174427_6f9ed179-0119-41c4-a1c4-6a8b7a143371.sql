
-- Referral program settings: 3 cycles + 7-14 days payout delay
ALTER TABLE public.referral_program_settings
  ADD COLUMN IF NOT EXISTS payout_delay_min_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS payout_delay_max_days integer NOT NULL DEFAULT 14;

UPDATE public.referral_program_settings
  SET required_cycles = 3,
      payout_delay_min_days = 7,
      payout_delay_max_days = 14;

-- New referrals default to 3 cycles
ALTER TABLE public.client_referrals
  ALTER COLUMN required_cycles SET DEFAULT 3;

-- Backfill in-flight referrals only (not yet qualified/closed)
UPDATE public.client_referrals
  SET required_cycles = 3
  WHERE required_cycles < 3
    AND status NOT IN ('qualified','reward_pending','reward_issued','cancelled','disqualified');
