-- Module 54 Phase C.1 — Canonicalize subscription_number onto billing_subscriptions
-- Read-only backfill from legacy public.subscriptions using order_id as join key.

-- 1) Add column (nullable, no default) — non-destructive
ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS subscription_number text;

COMMENT ON COLUMN public.billing_subscriptions.subscription_number
  IS 'Human-readable subscription identifier (format: SUB-######). Migrated from legacy public.subscriptions in Module 54 Phase C.1. Populated going forward by billing-create-order flow.';

-- 2) Dedicated sequence for future numbering, seeded from legacy max
DO $$
DECLARE
  v_max_legacy int := 0;
  v_num int;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN subscription_number ~ '^SUB-[0-9]+$'
      THEN (regexp_replace(subscription_number, '^SUB-', ''))::int
      ELSE 0
    END
  ), 0)
  INTO v_max_legacy
  FROM public.subscriptions;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'billing_subscription_number_seq' AND relkind = 'S'
  ) THEN
    EXECUTE format(
      'CREATE SEQUENCE public.billing_subscription_number_seq START WITH %s INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1',
      GREATEST(v_max_legacy + 1, 1001)
    );
  END IF;
END $$;

GRANT USAGE, SELECT ON SEQUENCE public.billing_subscription_number_seq TO service_role;

-- 3) Backfill from legacy subscriptions via order_id (1:1 verified: 13 matches over 17 legacy rows)
UPDATE public.billing_subscriptions bs
SET subscription_number = s.subscription_number
FROM public.subscriptions s
WHERE bs.order_id = s.order_id
  AND s.order_id IS NOT NULL
  AND s.subscription_number IS NOT NULL
  AND bs.subscription_number IS NULL;

-- 4) Partial unique index (guards duplicates without forcing NOT NULL yet)
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_subscriptions_subscription_number
  ON public.billing_subscriptions (subscription_number)
  WHERE subscription_number IS NOT NULL;

-- 5) Post-migration self-check: fail loudly if any duplicate slipped in
DO $$
DECLARE
  v_dupes int;
BEGIN
  SELECT COUNT(*) INTO v_dupes FROM (
    SELECT subscription_number
    FROM public.billing_subscriptions
    WHERE subscription_number IS NOT NULL
    GROUP BY subscription_number
    HAVING COUNT(*) > 1
  ) d;
  IF v_dupes > 0 THEN
    RAISE EXCEPTION 'Module 54 C.1 backfill produced % duplicate subscription_number(s)', v_dupes;
  END IF;
END $$;