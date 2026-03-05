-- Telco-grade traceability primitives (without hard check constraint yet)

ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id text;

CREATE TABLE IF NOT EXISTS public.billing_subscription_trace_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.billing_subscriptions(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.billing_customers(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_admin_id uuid NULL,
  source_type text NULL,
  source_id text NULL,
  reason text NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_subscription_trace_audit ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'billing_subscription_trace_audit'
      AND policyname = 'admin_read_subscription_trace_audit'
  ) THEN
    CREATE POLICY admin_read_subscription_trace_audit
      ON public.billing_subscription_trace_audit
      FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'billing_subscription_trace_audit'
      AND policyname = 'admin_insert_subscription_trace_audit'
  ) THEN
    CREATE POLICY admin_insert_subscription_trace_audit
      ON public.billing_subscription_trace_audit
      FOR INSERT
      TO authenticated
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sub_trace_audit_subscription ON public.billing_subscription_trace_audit(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_trace_audit_created_at ON public.billing_subscription_trace_audit(created_at DESC);

CREATE OR REPLACE FUNCTION public.trg_ensure_residential_subscription_traceability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF lower(coalesce(NEW.service_category, '')) IN ('internet', 'tv', 'combo', 'combo_tv_internet')
     AND lower(NEW.status::text) IN ('active', 'pending', 'suspended') THEN
    IF NEW.order_id IS NULL AND (NEW.source_type IS NULL OR NEW.source_id IS NULL) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'ORDER_TRACE_REQUIRED',
        DETAIL = 'Residential subscriptions require order_id or source_type/source_id traceability';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_residential_subscription_traceability ON public.billing_subscriptions;
CREATE TRIGGER ensure_residential_subscription_traceability
BEFORE INSERT OR UPDATE OF order_id, source_type, source_id, service_category, status
ON public.billing_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.trg_ensure_residential_subscription_traceability();