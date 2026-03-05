-- Guard systémique: toute subscription résidentielle doit avoir un address_id
CREATE OR REPLACE FUNCTION public.trg_ensure_residential_subscription_address()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_resolved uuid;
BEGIN
  IF lower(COALESCE(NEW.service_category, '')) IN ('internet', 'tv', 'combo', 'combo_tv_internet') THEN
    IF NEW.address_id IS NULL THEN
      v_resolved := public.resolve_or_create_service_address(NEW.customer_id, NEW.order_id);
      NEW.address_id := v_resolved;
    END IF;

    IF NEW.address_id IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'ADDRESS_REQUIRED',
        DETAIL = 'Residential subscriptions (internet/tv/combo) require address_id';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Check constraint DB-level (défense en profondeur)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_residential_address_required'
      AND conrelid = 'public.billing_subscriptions'::regclass
  ) THEN
    ALTER TABLE public.billing_subscriptions
    ADD CONSTRAINT chk_residential_address_required
    CHECK (
      lower(COALESCE(service_category, '')) NOT IN ('internet', 'tv', 'combo', 'combo_tv_internet')
      OR address_id IS NOT NULL
    ) NOT VALID;
  END IF;
END;
$$;

ALTER TABLE public.billing_subscriptions
VALIDATE CONSTRAINT chk_residential_address_required;