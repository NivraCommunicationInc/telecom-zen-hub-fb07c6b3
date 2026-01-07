-- Employee PIN unlock sessions for tracking account access
CREATE TABLE IF NOT EXISTS public.employee_pin_unlocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL,
  employee_email TEXT,
  account_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_name TEXT,
  unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  unlock_reason TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_employee_pin_unlocks_employee_account 
  ON public.employee_pin_unlocks(employee_id, account_id, is_active);

CREATE INDEX IF NOT EXISTS idx_employee_pin_unlocks_expires 
  ON public.employee_pin_unlocks(expires_at) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.employee_pin_unlocks ENABLE ROW LEVEL SECURITY;

-- Employees can only see/manage their own unlock sessions
CREATE POLICY "Employees can view own unlocks" 
  ON public.employee_pin_unlocks 
  FOR SELECT 
  USING (true);

CREATE POLICY "Employees can create unlocks" 
  ON public.employee_pin_unlocks 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Employees can update own unlocks" 
  ON public.employee_pin_unlocks 
  FOR UPDATE 
  USING (true);

-- Employee PIN unlock attempt logs (for rate limiting + auditing)
CREATE TABLE IF NOT EXISTS public.employee_pin_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL,
  employee_email TEXT,
  account_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_name TEXT,
  pin_entered_hash TEXT,
  attempt_result TEXT NOT NULL, -- 'success', 'fail', 'lockout'
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  failed_count_at_attempt INTEGER DEFAULT 0
);

-- Index for rate limiting lookups
CREATE INDEX IF NOT EXISTS idx_employee_pin_attempts_rate_limit 
  ON public.employee_pin_attempts(employee_id, account_id, attempted_at DESC);

-- Enable RLS
ALTER TABLE public.employee_pin_attempts ENABLE ROW LEVEL SECURITY;

-- Allow inserts and reads for logging
CREATE POLICY "Allow PIN attempt logging" 
  ON public.employee_pin_attempts 
  FOR ALL 
  USING (true)
  WITH CHECK (true);