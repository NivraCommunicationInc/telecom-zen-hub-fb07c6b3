-- Create table for storing hashed client login PINs
CREATE TABLE public.client_login_pins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_client_login_pins_email ON public.client_login_pins(email);
CREATE INDEX idx_client_login_pins_user_id ON public.client_login_pins(user_id);
CREATE INDEX idx_client_login_pins_expires_at ON public.client_login_pins(expires_at);

-- Enable Row Level Security
ALTER TABLE public.client_login_pins ENABLE ROW LEVEL SECURITY;

-- No public RLS policies - this table is only accessed by edge functions using service role
-- Edge functions use the service role key which bypasses RLS