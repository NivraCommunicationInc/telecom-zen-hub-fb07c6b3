ALTER TABLE public.billing_subscriptions
  DROP CONSTRAINT IF EXISTS chk_residential_traceability_required;

ALTER TABLE public.billing_subscriptions
  ADD CONSTRAINT chk_residential_traceability_required
  CHECK (
    lower(coalesce(service_category, '')) NOT IN ('internet', 'tv', 'combo', 'combo_tv_internet')
    OR lower(status::text) NOT IN ('active', 'pending', 'suspended')
    OR order_id IS NOT NULL
    OR (source_type IS NOT NULL AND source_id IS NOT NULL)
  );