
-- 1) Program settings: add payout delay + bump required_cycles default to 3
ALTER TABLE public.referral_program_settings
  ADD COLUMN IF NOT EXISTS required_cycles INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS payout_delay_min_days INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS payout_delay_max_days INTEGER NOT NULL DEFAULT 14;

UPDATE public.referral_program_settings
   SET required_cycles = 3,
       payout_delay_min_days = 7,
       payout_delay_max_days = 14,
       updated_at = now();

-- 2) client_referrals: new default = 3
ALTER TABLE public.client_referrals
  ALTER COLUMN required_cycles SET DEFAULT 3;

-- 3) Upgrade in-flight referrals (not yet qualified/disqualified/rewarded) from 2 -> 3
UPDATE public.client_referrals
   SET required_cycles = 3
 WHERE required_cycles < 3
   AND status::text NOT IN ('qualified','disqualified','reward_issued')
   AND reward_status::text NOT IN ('reward_issued');
