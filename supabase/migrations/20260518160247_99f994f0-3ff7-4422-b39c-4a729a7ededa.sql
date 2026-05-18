
CREATE TABLE IF NOT EXISTS public.auth_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_attempted text NOT NULL,
  ip_address text,
  user_agent text,
  success boolean NOT NULL DEFAULT false,
  failure_reason text,
  portal text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_email_time
  ON public.auth_login_attempts (lower(email_attempted), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_ip_time
  ON public.auth_login_attempts (ip_address, created_at DESC);

ALTER TABLE public.auth_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view login attempts"
ON public.auth_login_attempts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- No public INSERT policy: edge function uses service_role to insert.

-- Track alert dispatch to prevent spamming
CREATE TABLE IF NOT EXISTS public.auth_login_alerts_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_attempted text NOT NULL,
  ip_address text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_login_alerts_sent_time
  ON public.auth_login_alerts_sent (lower(email_attempted), sent_at DESC);

ALTER TABLE public.auth_login_alerts_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view login alerts sent"
ON public.auth_login_alerts_sent
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
