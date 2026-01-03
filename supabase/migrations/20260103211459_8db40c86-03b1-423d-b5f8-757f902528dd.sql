-- Create pin_invite_tokens table for secure PIN setup invitations
CREATE TABLE public.pin_invite_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('employee', 'technician')),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_admin_id UUID NOT NULL
);

-- Create index for fast lookup
CREATE INDEX idx_pin_invite_tokens_token_hash ON public.pin_invite_tokens(token_hash);
CREATE INDEX idx_pin_invite_tokens_email ON public.pin_invite_tokens(email);

-- Enable RLS
ALTER TABLE public.pin_invite_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can access (edge functions)
CREATE POLICY "Service role only" ON public.pin_invite_tokens
  FOR ALL USING (false);

-- Add comment
COMMENT ON TABLE public.pin_invite_tokens IS 'One-time tokens for secure PIN setup by employees/technicians';