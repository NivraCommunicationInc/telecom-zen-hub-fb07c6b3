-- Support full invitation lifecycle in Core Staff Management
ALTER TABLE public.staff_onboarding_tokens
  ADD COLUMN IF NOT EXISTS sent_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS revoked_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS revoked_by_admin_id uuid;

-- Backfill historical invitations as already sent
UPDATE public.staff_onboarding_tokens
SET sent_at = COALESCE(sent_at, created_at, now())
WHERE sent_at IS NULL;

-- Performance indexes for latest-status lookups and pending token filtering
CREATE INDEX IF NOT EXISTS idx_staff_onboarding_tokens_user_created_at
  ON public.staff_onboarding_tokens (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_onboarding_tokens_active
  ON public.staff_onboarding_tokens (user_id, expires_at)
  WHERE used_at IS NULL AND revoked_at IS NULL;