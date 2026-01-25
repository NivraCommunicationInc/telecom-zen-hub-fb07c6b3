-- Add onboarding and terms acceptance columns to user_roles
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS terms_version TEXT DEFAULT '1.0',
ADD COLUMN IF NOT EXISTS staff_pin_hash TEXT,
ADD COLUMN IF NOT EXISTS staff_pin_salt TEXT,
ADD COLUMN IF NOT EXISTS staff_pin_set_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS staff_pin_failed_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS staff_pin_lockout_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS require_terms_acceptance BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS require_onboarding BOOLEAN DEFAULT true;

-- Create staff onboarding tokens table for secure profile setup
CREATE TABLE IF NOT EXISTS public.staff_onboarding_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by_admin_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_onboarding_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can manage these tokens (via edge functions)
CREATE POLICY "Service role manages onboarding tokens" ON public.staff_onboarding_tokens
FOR ALL USING (false) WITH CHECK (false);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_staff_onboarding_tokens_hash ON public.staff_onboarding_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_staff_onboarding_tokens_user ON public.staff_onboarding_tokens(user_id);

-- Create staff client access sessions table for PIN re-authentication
CREATE TABLE IF NOT EXISTS public.staff_client_access_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID NOT NULL,
  client_user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  verified_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  verification_method TEXT DEFAULT 'pin',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_client_access_sessions ENABLE ROW LEVEL SECURITY;

-- Staff can read their own access sessions
CREATE POLICY "Staff can view own access sessions" ON public.staff_client_access_sessions
FOR SELECT USING (staff_user_id = auth.uid());

-- Staff can create access sessions
CREATE POLICY "Staff can create access sessions" ON public.staff_client_access_sessions
FOR INSERT WITH CHECK (staff_user_id = auth.uid());

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_staff_client_access_sessions ON public.staff_client_access_sessions(staff_user_id, client_user_id, expires_at);

-- Create function to verify staff PIN
CREATE OR REPLACE FUNCTION public.verify_staff_pin(p_user_id UUID, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stored_hash TEXT;
  v_salt TEXT;
  v_computed_hash TEXT;
  v_iterations INTEGER := 100000;
BEGIN
  -- Get stored hash and salt
  SELECT staff_pin_hash, staff_pin_salt INTO v_stored_hash, v_salt
  FROM user_roles
  WHERE user_id = p_user_id;
  
  IF v_stored_hash IS NULL OR v_salt IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Compute hash using PBKDF2 simulation (SHA-256)
  -- Note: In production, we use the edge function for proper PBKDF2
  -- This is a fallback for direct DB verification
  v_computed_hash := encode(
    sha256((v_salt || p_pin)::bytea),
    'hex'
  );
  
  -- Compare first 64 chars (simple comparison - edge function uses proper PBKDF2)
  RETURN v_computed_hash = v_stored_hash;
END;
$$;