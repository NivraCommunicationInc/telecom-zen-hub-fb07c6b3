-- Table for storing admin secret codes (hashed)
CREATE TABLE public.admin_security_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL UNIQUE,
  code_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_security_codes ENABLE ROW LEVEL SECURITY;

-- No direct access from client - only via edge functions with service role
CREATE POLICY "No direct access" ON public.admin_security_codes
  FOR ALL USING (false);

-- Table for tracking verification attempts and locks
CREATE TABLE public.admin_secret_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_secret_attempts ENABLE ROW LEVEL SECURITY;

-- No direct access from client
CREATE POLICY "No direct access" ON public.admin_secret_attempts
  FOR ALL USING (false);

-- Index for faster lookups
CREATE INDEX idx_admin_secret_attempts_session ON public.admin_secret_attempts(admin_user_id, session_id);

-- Audit log for secret code events
CREATE TABLE public.admin_secret_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id TEXT NOT NULL,
  admin_user_id UUID NOT NULL,
  event TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_secret_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can view their own audit logs
CREATE POLICY "Admins can view audit logs" ON public.admin_secret_audit_log
  FOR SELECT USING (true);

-- Index for faster lookups
CREATE INDEX idx_admin_secret_audit_log_user ON public.admin_secret_audit_log(admin_user_id);
CREATE INDEX idx_admin_secret_audit_log_created ON public.admin_secret_audit_log(created_at DESC);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION public.update_admin_security_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers
CREATE TRIGGER update_admin_security_codes_updated_at
  BEFORE UPDATE ON public.admin_security_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_admin_security_updated_at();

CREATE TRIGGER update_admin_secret_attempts_updated_at
  BEFORE UPDATE ON public.admin_secret_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_admin_security_updated_at();