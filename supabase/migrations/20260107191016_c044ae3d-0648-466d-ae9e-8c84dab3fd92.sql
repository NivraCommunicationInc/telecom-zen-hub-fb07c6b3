-- Rate limiting tables for server-side enforcement

-- Table to store rate limit attempts
CREATE TABLE IF NOT EXISTS public.rate_limit_attempts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to store active lockouts
CREATE TABLE IF NOT EXISTS public.rate_limit_lockouts (
    key TEXT NOT NULL PRIMARY KEY,
    locked_until TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_limit_attempts_key_created 
    ON public.rate_limit_attempts(key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limit_lockouts_locked_until 
    ON public.rate_limit_lockouts(locked_until);

-- Auto-cleanup old attempts (older than 2 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Delete attempts older than 2 hours
    DELETE FROM public.rate_limit_attempts 
    WHERE created_at < (now() - interval '2 hours');
    
    -- Delete expired lockouts
    DELETE FROM public.rate_limit_lockouts 
    WHERE locked_until < now();
END;
$$;

-- Enable RLS (only service role can access these)
ALTER TABLE public.rate_limit_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_lockouts ENABLE ROW LEVEL SECURITY;

-- No policies = only service role key can access (which is what we want for edge functions)