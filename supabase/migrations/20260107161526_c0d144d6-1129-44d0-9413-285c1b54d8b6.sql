-- 1) Add user_id to employees table for identity lookup
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE;
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);

-- 2) Add pin_salt for per-user salt (PBKDF2)
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pin_salt TEXT;

-- 3) Remove pin_entered_hash from employee_pin_attempts (security: never store entered PIN artifacts)
ALTER TABLE public.employee_pin_attempts DROP COLUMN IF EXISTS pin_entered_hash;

-- 4) Create server-authoritative lockout table per (employee_id, account_id)
CREATE TABLE IF NOT EXISTS public.employee_pin_lockouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, account_id)
);

-- Enable RLS on lockouts
ALTER TABLE public.employee_pin_lockouts ENABLE ROW LEVEL SECURITY;

-- Only service role can access lockouts
CREATE POLICY "Service role only for lockouts" ON public.employee_pin_lockouts
  FOR ALL USING (false);

CREATE INDEX IF NOT EXISTS idx_employee_pin_lockouts_lookup 
  ON public.employee_pin_lockouts(employee_id, account_id);

-- 5) Create append-only payments table (immutable payment records)
CREATE TABLE IF NOT EXISTS public.employee_recorded_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_id UUID NOT NULL REFERENCES public.billing(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL,
  account_id UUID,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL,
  payment_reference TEXT,
  notes TEXT,
  recorded_by_employee_id UUID NOT NULL REFERENCES public.employees(id),
  recorded_by_employee_email TEXT,
  idempotency_key TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending_verification',
  verified_at TIMESTAMPTZ,
  verified_by_admin_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_recorded_payments ENABLE ROW LEVEL SECURITY;

-- Only service role can access payments
CREATE POLICY "Service role only for recorded payments" ON public.employee_recorded_payments
  FOR ALL USING (false);

CREATE INDEX IF NOT EXISTS idx_employee_recorded_payments_billing 
  ON public.employee_recorded_payments(billing_id);
CREATE INDEX IF NOT EXISTS idx_employee_recorded_payments_idempotency 
  ON public.employee_recorded_payments(idempotency_key);

-- 6) Add rate limiting tracking for client search
CREATE TABLE IF NOT EXISTS public.employee_search_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  search_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_search_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for rate limits" ON public.employee_search_rate_limits
  FOR ALL USING (false);

CREATE INDEX IF NOT EXISTS idx_employee_search_rate_limits_lookup 
  ON public.employee_search_rate_limits(employee_id, window_start);

-- 7) Update trigger for lockouts updated_at
CREATE OR REPLACE FUNCTION public.update_employee_pin_lockouts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_employee_pin_lockouts_updated_at ON public.employee_pin_lockouts;
CREATE TRIGGER update_employee_pin_lockouts_updated_at
  BEFORE UPDATE ON public.employee_pin_lockouts
  FOR EACH ROW EXECUTE FUNCTION public.update_employee_pin_lockouts_updated_at();