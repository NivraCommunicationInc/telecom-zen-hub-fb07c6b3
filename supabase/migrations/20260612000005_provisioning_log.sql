-- Fix: create provisioning_log table that provisioning-engine and
-- reactivationEngine.ts both insert into but didn't exist in production.

CREATE TABLE IF NOT EXISTS public.provisioning_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID       REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  customer_id    UUID,
  action         TEXT        NOT NULL,
  adapter        TEXT        NOT NULL DEFAULT 'manual',
  trigger        TEXT,
  status         TEXT        NOT NULL,
  details        JSONB       DEFAULT '{}',
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.provisioning_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_provisioning_log ON public.provisioning_log
  USING (auth.jwt() ->> 'role' IN ('admin','supervisor','techops'));

GRANT SELECT ON public.provisioning_log TO authenticated;
GRANT ALL ON public.provisioning_log TO service_role;

CREATE INDEX IF NOT EXISTS idx_provisioning_log_subscription
  ON public.provisioning_log(subscription_id);
CREATE INDEX IF NOT EXISTS idx_provisioning_log_created_at
  ON public.provisioning_log(created_at DESC);
