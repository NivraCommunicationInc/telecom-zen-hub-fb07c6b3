
-- Monitoring table for billing automation runs
CREATE TABLE public.billing_automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL, -- 'daily_lifecycle', 'backfill', 'manual'
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
  
  -- Counters
  subscriptions_expired INT DEFAULT 0,
  invoices_voided INT DEFAULT 0,
  renewals_generated INT DEFAULT 0,
  reminders_queued INT DEFAULT 0,
  errors_count INT DEFAULT 0,
  
  -- Details
  processed_items JSONB DEFAULT '[]'::jsonb,
  errors JSONB DEFAULT '[]'::jsonb,
  summary TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view automation runs" ON public.billing_automation_runs
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'employee'::app_role)
);

-- Index for quick "last run" queries
CREATE INDEX idx_billing_automation_runs_type_started 
ON public.billing_automation_runs(run_type, started_at DESC);
