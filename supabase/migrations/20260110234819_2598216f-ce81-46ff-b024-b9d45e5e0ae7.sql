-- =============================================
-- ADMIN OTP SYSTEM - Complete Implementation
-- =============================================

-- 1) Table: admin_otp_codes
-- Stores OTP codes with hashing, expiration, attempts tracking
DROP TABLE IF EXISTS public.admin_otp_codes CASCADE;
CREATE TABLE public.admin_otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  email TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  request_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  consumed_at TIMESTAMPTZ NULL,
  locked_at TIMESTAMPTZ NULL,
  ip TEXT NULL,
  user_agent TEXT NULL
);

-- Indexes for admin_otp_codes
CREATE INDEX idx_admin_otp_codes_user_created ON public.admin_otp_codes (admin_user_id, created_at DESC);
CREATE INDEX idx_admin_otp_codes_email_created ON public.admin_otp_codes (email, created_at DESC);
CREATE INDEX idx_admin_otp_codes_request_id ON public.admin_otp_codes (request_id);

-- Enable RLS
ALTER TABLE public.admin_otp_codes ENABLE ROW LEVEL SECURITY;

-- RLS: Only service role can access (edge functions)
CREATE POLICY "Service role only for admin_otp_codes"
ON public.admin_otp_codes
FOR ALL
USING (false)
WITH CHECK (false);

-- 2) Table: admin_otp_sessions
-- Prevents bypass via refresh/direct navigation
DROP TABLE IF EXISTS public.admin_otp_sessions CASCADE;
CREATE TABLE public.admin_otp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  session_token_hash TEXT NOT NULL,
  request_id TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '12 hours'),
  revoked_at TIMESTAMPTZ NULL
);

-- Indexes for admin_otp_sessions
CREATE INDEX idx_admin_otp_sessions_user_verified ON public.admin_otp_sessions (admin_user_id, verified_at DESC);
CREATE INDEX idx_admin_otp_sessions_token_hash ON public.admin_otp_sessions (session_token_hash);

-- Enable RLS
ALTER TABLE public.admin_otp_sessions ENABLE ROW LEVEL SECURITY;

-- RLS: Only service role can access
CREATE POLICY "Service role only for admin_otp_sessions"
ON public.admin_otp_sessions
FOR ALL
USING (false)
WITH CHECK (false);

-- 3) Table: admin_auth_audit_log
-- Complete audit trail for OTP events
DROP TABLE IF EXISTS public.admin_auth_audit_log CASCADE;
CREATE TABLE public.admin_auth_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  admin_user_id UUID NOT NULL,
  email TEXT NOT NULL,
  request_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB NULL
);

-- Indexes for audit log
CREATE INDEX idx_admin_auth_audit_log_created ON public.admin_auth_audit_log (created_at DESC);
CREATE INDEX idx_admin_auth_audit_log_user ON public.admin_auth_audit_log (admin_user_id, created_at DESC);
CREATE INDEX idx_admin_auth_audit_log_event ON public.admin_auth_audit_log (event, created_at DESC);

-- Enable RLS
ALTER TABLE public.admin_auth_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS: Only service role can insert, admins can read their own logs
CREATE POLICY "Service role insert for admin_auth_audit_log"
ON public.admin_auth_audit_log
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Admins can read own audit logs"
ON public.admin_auth_audit_log
FOR SELECT
USING (admin_user_id = auth.uid());

-- 4) Function to check if admin has valid OTP session
CREATE OR REPLACE FUNCTION public.check_admin_otp_session(p_admin_user_id UUID, p_session_token_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_otp_sessions
    WHERE admin_user_id = p_admin_user_id
      AND session_token_hash = p_session_token_hash
      AND revoked_at IS NULL
      AND now() < expires_at
  );
END;
$$;

-- 5) Function to clean up expired OTP codes and sessions (can be called periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_admin_otp()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Lock expired but unconsumed codes
  UPDATE public.admin_otp_codes
  SET locked_at = now()
  WHERE consumed_at IS NULL
    AND locked_at IS NULL
    AND now() >= expires_at;
    
  -- Delete very old records (older than 30 days)
  DELETE FROM public.admin_otp_codes
  WHERE created_at < now() - interval '30 days';
  
  DELETE FROM public.admin_otp_sessions
  WHERE created_at < now() - interval '30 days';
END;
$$;