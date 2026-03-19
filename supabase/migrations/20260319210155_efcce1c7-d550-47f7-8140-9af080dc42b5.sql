
-- Customer security table for PIN storage
CREATE TABLE IF NOT EXISTS public.customer_security (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL UNIQUE,
  pin_hash text NOT NULL,
  pin_salt text NOT NULL,
  pin_attempts int NOT NULL DEFAULT 0,
  lock_until timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Customer access sessions for employee access
CREATE TABLE IF NOT EXISTS public.customer_access_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ip_address text,
  user_agent text,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_access_sessions ENABLE ROW LEVEL SECURITY;

-- RLS: Only staff with employee access can read customer_security (never expose pin_hash)
CREATE POLICY "Staff can check customer security exists"
  ON public.customer_security FOR SELECT TO authenticated
  USING (public.check_portal_access(auth.uid(), 'employee'));

-- RLS: Staff can read their own access sessions
CREATE POLICY "Staff can read own access sessions"
  ON public.customer_access_sessions FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

-- RLS: Staff can insert access sessions (via edge function with service role, but allow select)
CREATE POLICY "Staff can view active sessions"
  ON public.customer_access_sessions FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid());

-- Index for fast session lookups
CREATE INDEX idx_customer_access_sessions_lookup
  ON public.customer_access_sessions (employee_id, customer_id, expires_at DESC);

CREATE INDEX idx_customer_security_customer
  ON public.customer_security (customer_id);
