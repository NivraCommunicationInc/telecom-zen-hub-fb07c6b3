
-- 1. Ajout billing_anchor_day sur accounts
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS billing_anchor_day smallint;

UPDATE public.accounts
SET billing_anchor_day = LEAST(GREATEST(EXTRACT(day FROM created_at)::int, 1), 28)
WHERE billing_anchor_day IS NULL;

ALTER TABLE public.accounts
  ALTER COLUMN billing_anchor_day SET DEFAULT LEAST(GREATEST(EXTRACT(day FROM now())::int, 1), 28);

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_billing_anchor_day_range
  CHECK (billing_anchor_day IS NULL OR (billing_anchor_day BETWEEN 1 AND 28));

-- 2. Index accélérateur (idempotent)
CREATE INDEX IF NOT EXISTS idx_billing_invoice_lines_service_address_id
  ON public.billing_invoice_lines(service_address_id);

-- 3. Fonction canonique compute_prorata_for_service
CREATE OR REPLACE FUNCTION public.compute_prorata_for_service(
  p_account_id uuid,
  p_service_address_id uuid,
  p_monthly_price_cents integer,
  p_activation_date date DEFAULT current_date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anchor smallint;
  v_prev_anchor date;
  v_next_anchor date;
  v_days_in_cycle int;
  v_days_remaining int;
  v_prorata_cents int;
  v_activation date := COALESCE(p_activation_date, current_date);
  v_year int;
  v_month int;
  v_day int;
BEGIN
  IF p_monthly_price_cents IS NULL OR p_monthly_price_cents < 0 THEN
    RAISE EXCEPTION 'monthly_price_cents must be >= 0';
  END IF;

  SELECT COALESCE(billing_anchor_day, LEAST(GREATEST(EXTRACT(day FROM created_at)::int, 1), 28))
    INTO v_anchor
  FROM public.accounts
  WHERE id = p_account_id;

  IF v_anchor IS NULL THEN
    v_anchor := LEAST(GREATEST(EXTRACT(day FROM v_activation)::int, 1), 28);
  END IF;

  v_year := EXTRACT(year FROM v_activation)::int;
  v_month := EXTRACT(month FROM v_activation)::int;
  v_day := EXTRACT(day FROM v_activation)::int;

  IF v_day >= v_anchor THEN
    v_prev_anchor := make_date(v_year, v_month, v_anchor);
    v_next_anchor := (v_prev_anchor + interval '1 month')::date;
  ELSE
    v_next_anchor := make_date(v_year, v_month, v_anchor);
    v_prev_anchor := (v_next_anchor - interval '1 month')::date;
  END IF;

  v_days_in_cycle := (v_next_anchor - v_prev_anchor);
  v_days_remaining := (v_next_anchor - v_activation);

  IF v_days_remaining <= 0 OR v_days_remaining >= v_days_in_cycle THEN
    -- Ajout le jour même de l'anchor: pas de prorata, cycle plein démarre.
    v_days_remaining := 0;
    v_prorata_cents := 0;
  ELSE
    v_prorata_cents := ROUND((p_monthly_price_cents::numeric * v_days_remaining::numeric) / v_days_in_cycle::numeric)::int;
  END IF;

  RETURN jsonb_build_object(
    'account_id', p_account_id,
    'service_address_id', p_service_address_id,
    'activation_date', v_activation,
    'anchor_day', v_anchor,
    'prev_anchor', v_prev_anchor,
    'next_anchor', v_next_anchor,
    'days_in_cycle', v_days_in_cycle,
    'days_remaining', v_days_remaining,
    'monthly_price_cents', p_monthly_price_cents,
    'prorata_cents', v_prorata_cents,
    'is_zero', v_prorata_cents = 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.compute_prorata_for_service(uuid, uuid, integer, date) FROM public;
GRANT EXECUTE ON FUNCTION public.compute_prorata_for_service(uuid, uuid, integer, date) TO authenticated, service_role;

-- 4. Wrapper lecture publique (utilisé par le hook useProratePreview)
CREATE OR REPLACE FUNCTION public.preview_prorata(
  p_account_id uuid,
  p_service_address_id uuid,
  p_monthly_price_cents integer,
  p_activation_date date DEFAULT current_date
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.compute_prorata_for_service(p_account_id, p_service_address_id, p_monthly_price_cents, p_activation_date);
$$;

REVOKE ALL ON FUNCTION public.preview_prorata(uuid, uuid, integer, date) FROM public;
GRANT EXECUTE ON FUNCTION public.preview_prorata(uuid, uuid, integer, date) TO authenticated, anon, service_role;
