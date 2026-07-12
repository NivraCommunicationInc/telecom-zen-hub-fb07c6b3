-- =========================================================================
-- BLOQUANT 3: subscription_number canonical generation
-- Format: SUB-###### (6 zero-padded digits from billing_subscription_number_seq)
-- Uniqueness: enforced by existing UNIQUE partial index
--             idx_billing_subscriptions_subscription_number
-- =========================================================================

CREATE OR REPLACE FUNCTION public.fn_generate_subscription_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num bigint;
  v_candidate text;
  v_attempts int := 0;
BEGIN
  LOOP
    v_num := nextval('public.billing_subscription_number_seq');
    v_candidate := 'SUB-' || lpad(v_num::text, 6, '0');
    -- Extremely defensive: ensure no collision (in case of manual backfill)
    IF NOT EXISTS (
      SELECT 1 FROM public.billing_subscriptions
      WHERE subscription_number = v_candidate
    ) THEN
      RETURN v_candidate;
    END IF;
    v_attempts := v_attempts + 1;
    IF v_attempts > 100 THEN
      RAISE EXCEPTION 'fn_generate_subscription_number: unable to allocate unique number after 100 attempts';
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.fn_generate_subscription_number() IS
  'Canonical generator for billing_subscriptions.subscription_number. Format: SUB-###### (6 zero-padded). Source: billing_subscription_number_seq. Uniqueness enforced by idx_billing_subscriptions_subscription_number.';

-- Trigger: auto-fill subscription_number on INSERT if not provided
CREATE OR REPLACE FUNCTION public.trg_billing_subscriptions_set_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.subscription_number IS NULL OR NEW.subscription_number = '' THEN
    NEW.subscription_number := public.fn_generate_subscription_number();
  ELSIF NEW.subscription_number !~ '^SUB-[0-9]{6,}$' THEN
    RAISE EXCEPTION 'Invalid subscription_number format: % (expected SUB-######)', NEW.subscription_number
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_subscriptions_set_number ON public.billing_subscriptions;
CREATE TRIGGER trg_billing_subscriptions_set_number
BEFORE INSERT ON public.billing_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.trg_billing_subscriptions_set_number();

-- Realign sequence past current max (SUB-001030) before backfill,
-- to guarantee no collision with pre-existing numbers.
DO $$
DECLARE
  v_max bigint;
  v_seq_cur bigint;
BEGIN
  SELECT COALESCE(MAX((regexp_replace(subscription_number, '^SUB-', ''))::bigint), 0)
    INTO v_max
    FROM public.billing_subscriptions
   WHERE subscription_number ~ '^SUB-[0-9]+$';
  SELECT last_value INTO v_seq_cur FROM public.billing_subscription_number_seq;
  IF v_max >= v_seq_cur THEN
    PERFORM setval('public.billing_subscription_number_seq', v_max + 1, false);
  END IF;
END $$;

-- Backfill: 6 existing rows with NULL subscription_number
-- Production rows (2) get canonical numbers; QA rows (4) get canonical numbers
-- (QA runners will still receive numbers — they are not in production data model).
UPDATE public.billing_subscriptions
   SET subscription_number = public.fn_generate_subscription_number()
 WHERE subscription_number IS NULL;

-- Add NOT NULL constraint after backfill so future rows are guaranteed to have a number
ALTER TABLE public.billing_subscriptions
  ALTER COLUMN subscription_number SET NOT NULL;
