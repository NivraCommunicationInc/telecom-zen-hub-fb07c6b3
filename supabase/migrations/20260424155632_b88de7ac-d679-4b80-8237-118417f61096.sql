-- Add columns required for terms acceptance metadata and MFA tracking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_ip TEXT,
  ADD COLUMN IF NOT EXISTS mfa_method TEXT CHECK (mfa_method IN ('email', 'totp')),
  ADD COLUMN IF NOT EXISTS mfa_configured_at TIMESTAMPTZ;

-- Add mfa_required flag on user_roles (default true for staff)
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS mfa_required BOOLEAN NOT NULL DEFAULT true;

-- Backfill: clients should not be forced into MFA
UPDATE public.user_roles SET mfa_required = false WHERE role = 'client';