
ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_billing_invoices_account_id ON public.billing_invoices(account_id) WHERE account_id IS NOT NULL;

-- Only enforce uniqueness for consolidated RENEWAL invoices (initial invoices are per-order)
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_invoices_account_renewal_unique
  ON public.billing_invoices(account_id, cycle_start_date)
  WHERE subscription_id IS NULL AND account_id IS NOT NULL AND type = 'renewal';

UPDATE public.billing_invoices bi
SET account_id = a.id
FROM public.billing_customers bc
JOIN public.accounts a ON a.client_id = bc.user_id
WHERE bi.account_id IS NULL
  AND bi.customer_id = bc.id
  AND bc.user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_block_orphan_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_id IS NULL AND NEW.subscription_id IS NULL AND NEW.account_id IS NULL THEN
    RAISE EXCEPTION 'Orphan invoice: must have at least one of order_id, subscription_id, or account_id';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_hydrate_invoice_account_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_id IS NULL AND NEW.customer_id IS NOT NULL THEN
    SELECT a.id INTO NEW.account_id
    FROM public.billing_customers bc
    JOIN public.accounts a ON a.client_id = bc.user_id
    WHERE bc.id = NEW.customer_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hydrate_invoice_account_id ON public.billing_invoices;
CREATE TRIGGER trg_hydrate_invoice_account_id
  BEFORE INSERT ON public.billing_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_hydrate_invoice_account_id();

CREATE OR REPLACE FUNCTION public.get_accounts_due_for_renewal(
  p_window_start date,
  p_window_end date
)
RETURNS TABLE (
  account_id uuid,
  customer_id uuid,
  earliest_cycle_end date
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    a.id AS account_id,
    bc.id AS customer_id,
    MIN(bs.cycle_end_date) AS earliest_cycle_end
  FROM public.accounts a
  JOIN public.billing_customers bc ON bc.user_id = a.client_id
  JOIN public.billing_subscriptions bs ON bs.customer_id = bc.id
  WHERE bs.status = 'active'
    AND bs.cycle_end_date BETWEEN p_window_start AND p_window_end
  GROUP BY a.id, bc.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_accounts_due_for_renewal(date, date) TO service_role, authenticated;
