-- ==============================================================================
-- CANCELLATION ENGINE — Audit table for orchestrated account cancellations
-- ==============================================================================
-- Each invocation of the `cancel-account` edge function creates one row here.
-- This is the single audit point an operator can query to answer questions
-- like "did we actually cancel PayPal for client X?" or "why is the customer
-- still being billed after they cancelled?".
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.cancellation_runs (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id                  uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  initiated_by_user_id        uuid,
  initiated_by_email          text,
  initiated_by_role           text,
  reason                      text,
  -- 'full' = cancel everything and close the account (terminal)
  -- 'service' = cancel subscriptions but keep the account open (can re-order)
  scope                       text NOT NULL DEFAULT 'service' CHECK (scope IN ('full', 'service')),
  status                      text NOT NULL DEFAULT 'running'
                              CHECK (status IN ('running', 'completed', 'completed_with_errors', 'failed')),
  -- Granular step log — append-only JSONB array, each entry: {step, ok, detail, at}
  steps                       jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Aggregate counts so dashboards can show the impact at a glance.
  paypal_cancellations        int NOT NULL DEFAULT 0,
  subscriptions_cancelled     int NOT NULL DEFAULT 0,
  invoices_voided             int NOT NULL DEFAULT 0,
  commissions_flagged         int NOT NULL DEFAULT 0,
  promotions_frozen           int NOT NULL DEFAULT 0,
  adjustments_cancelled       int NOT NULL DEFAULT 0,
  email_queued                boolean NOT NULL DEFAULT false,
  account_closed              boolean NOT NULL DEFAULT false,
  errors                      jsonb NOT NULL DEFAULT '[]'::jsonb,
  duration_ms                 int,
  started_at                  timestamptz NOT NULL DEFAULT now(),
  completed_at                timestamptz
);

CREATE INDEX IF NOT EXISTS idx_cancellation_runs_account_id
  ON public.cancellation_runs (account_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_runs_started_at
  ON public.cancellation_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cancellation_runs_status
  ON public.cancellation_runs (status) WHERE status IN ('running', 'failed', 'completed_with_errors');

ALTER TABLE public.cancellation_runs ENABLE ROW LEVEL SECURITY;

-- Admin / supervisor / employee can read all cancellations.
DROP POLICY IF EXISTS "Staff can view cancellation runs" ON public.cancellation_runs;
CREATE POLICY "Staff can view cancellation runs"
  ON public.cancellation_runs
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_role(auth.uid(), 'employee'::app_role)
  );

-- Clients can see only their own (so the portal can show "your cancellation
-- was processed on date X").
DROP POLICY IF EXISTS "Clients can view their own cancellations" ON public.cancellation_runs;
CREATE POLICY "Clients can view their own cancellations"
  ON public.cancellation_runs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = cancellation_runs.account_id
        AND a.client_id = auth.uid()
    )
  );

-- Inserts / updates are restricted to service_role (the edge function uses
-- the service key) and admin (manual recovery / fixes).
DROP POLICY IF EXISTS "Admins can manage cancellation runs" ON public.cancellation_runs;
CREATE POLICY "Admins can manage cancellation runs"
  ON public.cancellation_runs
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Record this migration for traceability.
INSERT INTO public.security_events (event_type, severity, details)
VALUES (
  'CANCELLATION_ENGINE_INSTALLED',
  'info',
  jsonb_build_object(
    'description', 'cancellation_runs audit table created for cancel-account orchestrator',
    'applied_at', now()
  )
);
