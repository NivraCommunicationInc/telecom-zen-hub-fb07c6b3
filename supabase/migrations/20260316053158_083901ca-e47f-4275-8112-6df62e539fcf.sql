ALTER TABLE public.client_referrals
  ADD COLUMN IF NOT EXISTS reward_card_provider text,
  ADD COLUMN IF NOT EXISTS reward_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reward_delivered_at timestamptz;