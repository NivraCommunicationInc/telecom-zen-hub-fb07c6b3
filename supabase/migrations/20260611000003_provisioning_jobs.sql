-- ============================================================
-- provisioning_jobs — OSS Job Queue
-- Nivra Telecom — 2026-06-11
--
-- State machine: pending → running → success | failed | retrying
--
-- The provisioning-engine writes here on every call.
-- The Nivra Core UI reads here and can:
--   - Create PENDING jobs (manual trigger)
--   - Retry FAILED jobs
--   - Cancel PENDING jobs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.provisioning_jobs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Context
  subscription_id  uuid        REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  customer_id      uuid        REFERENCES public.billing_customers(id) ON DELETE SET NULL,
  -- Job definition
  action           text        NOT NULL CHECK (action IN (
                                 'activate', 'deactivate', 'terminate',
                                 'modify', 'reset', 'suspend', 'reactivate'
                               )),
  adapter          text        NOT NULL DEFAULT 'manual' CHECK (adapter IN (
                                 'manual', 'radius', 'olt', 'mikrotik', 'ubiquiti', 'tr069'
                               )),
  trigger          text        NOT NULL DEFAULT 'manual',
  -- Parameters passed to the engine
  parameters       jsonb       DEFAULT '{}',
  -- State machine
  status           text        NOT NULL DEFAULT 'pending' CHECK (status IN (
                                 'pending',   -- Waiting to be processed
                                 'running',   -- Being processed by provisioning-engine
                                 'success',   -- Completed successfully
                                 'failed',    -- Failed after max_attempts
                                 'retrying',  -- Will be retried (attempt_count < max_attempts)
                                 'cancelled'  -- Manually cancelled
                               )),
  -- Retry logic
  attempt_count    integer     NOT NULL DEFAULT 0,
  max_attempts     integer     NOT NULL DEFAULT 3,
  next_retry_at    timestamptz,
  -- Timestamps
  scheduled_at     timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  -- Result
  result           jsonb,
  error_message    text,
  -- Human context
  created_by       text        DEFAULT 'system',  -- 'system', 'admin:email', 'cron'
  notes            text
);

CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_subscription_id ON public.provisioning_jobs (subscription_id);
CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_customer_id     ON public.provisioning_jobs (customer_id);
CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_status          ON public.provisioning_jobs (status);
CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_created_at      ON public.provisioning_jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_next_retry_at   ON public.provisioning_jobs (next_retry_at) WHERE status = 'retrying';

ALTER TABLE public.provisioning_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_provisioning_jobs"
  ON public.provisioning_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Admin read (authenticated users in Core can read)
CREATE POLICY "authenticated_read_provisioning_jobs"
  ON public.provisioning_jobs FOR SELECT TO authenticated USING (true);
