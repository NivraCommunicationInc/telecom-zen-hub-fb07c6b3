
-- 1) Add columns (re-run safe with IF NOT EXISTS pattern)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_addresses' AND column_name='address_normalized') THEN
    ALTER TABLE public.service_addresses ADD COLUMN address_normalized text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_addresses' AND column_name='address_hash') THEN
    ALTER TABLE public.service_addresses ADD COLUMN address_hash text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_addresses' AND column_name='is_default') THEN
    ALTER TABLE public.service_addresses ADD COLUMN is_default boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='billing_invoices' AND column_name='address_snapshot') THEN
    ALTER TABLE public.billing_invoices ADD COLUMN address_snapshot jsonb;
  END IF;
END $$;

-- 2) Normalize function
CREATE OR REPLACE FUNCTION public.normalize_address(
  p_address_line text, p_city text, p_province text, p_postal_code text
) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(regexp_replace(trim(
    public.unaccent(
      coalesce(p_address_line, '') || '|' ||
      coalesce(p_city, '') || '|' ||
      coalesce(p_province, '') || '|' ||
      regexp_replace(coalesce(p_postal_code, ''), '\s', '', 'g')
    )
  ), '\s+', ' ', 'g'));
$$;

-- 3) Hash function
CREATE OR REPLACE FUNCTION public.compute_address_hash(
  p_address_line text, p_city text, p_province text, p_postal_code text
) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(sha256(convert_to(
    public.normalize_address(p_address_line, p_city, p_province, p_postal_code), 'UTF8'
  )), 'hex');
$$;

-- 4) Auto-normalize trigger
CREATE OR REPLACE FUNCTION public.trg_service_address_normalize()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.address_normalized := public.normalize_address(NEW.address_line, NEW.city, NEW.province, NEW.postal_code);
  NEW.address_hash := public.compute_address_hash(NEW.address_line, NEW.city, NEW.province, NEW.postal_code);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_address ON public.service_addresses;
CREATE TRIGGER trg_normalize_address
  BEFORE INSERT OR UPDATE OF address_line, city, province, postal_code
  ON public.service_addresses
  FOR EACH ROW EXECUTE FUNCTION public.trg_service_address_normalize();

-- 5) Unique hash per account
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_address_hash_per_account 
  ON public.service_addresses (account_id, address_hash) WHERE is_active = true;

-- 6) One default per account
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_default_address_per_account 
  ON public.service_addresses (account_id) WHERE is_default = true AND is_active = true;

-- 7) Default enforcement trigger
CREATE OR REPLACE FUNCTION public.trg_enforce_single_default_address()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_default = true AND NEW.is_active = true THEN
    UPDATE public.service_addresses SET is_default = false 
    WHERE account_id = NEW.account_id AND id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_default ON public.service_addresses;
CREATE TRIGGER trg_enforce_single_default
  BEFORE INSERT OR UPDATE OF is_default ON public.service_addresses
  FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_single_default_address();

-- 8) Backfill existing rows
UPDATE public.service_addresses 
SET address_normalized = public.normalize_address(address_line, city, province, postal_code),
    address_hash = public.compute_address_hash(address_line, city, province, postal_code)
WHERE address_hash IS NULL;

-- 9) Set first address as default if no default exists
UPDATE public.service_addresses sa SET is_default = true
WHERE sa.id = (
  SELECT id FROM public.service_addresses 
  WHERE account_id = sa.account_id AND is_active = true ORDER BY created_at ASC LIMIT 1
) AND NOT EXISTS (
  SELECT 1 FROM public.service_addresses WHERE account_id = sa.account_id AND is_default = true AND is_active = true
);

-- 10) Re-create duplicate guard index
DROP INDEX IF EXISTS public.idx_unique_sub_per_address_category;
CREATE UNIQUE INDEX idx_unique_sub_per_address_category 
  ON public.billing_subscriptions (customer_id, address_id, service_category) 
  WHERE status NOT IN ('cancelled', 'expired');

-- 11) Updated provisioning RPC with hash-based dedup + address snapshot
CREATE OR REPLACE FUNCTION public.provision_services_for_order(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order record;
  v_customer_id uuid;
  v_line_items jsonb;
  v_item jsonb;
  v_sub_id uuid;
  v_services_created int := 0;
  v_category text;
  v_address_id uuid;
  v_address_hash text;
  v_address_snapshot jsonb;
  v_account_id uuid;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF v_order IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND');
  END IF;

  SELECT customer_id INTO v_customer_id FROM billing_invoices WHERE order_id = p_order_id LIMIT 1;
  IF v_customer_id IS NULL THEN
    SELECT id INTO v_customer_id FROM billing_customers WHERE user_id = v_order.user_id LIMIT 1;
  END IF;
  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'CUSTOMER_NOT_FOUND');
  END IF;

  v_line_items := v_order.line_items;
  IF v_line_items IS NULL OR jsonb_array_length(v_line_items) = 0 THEN
    RETURN jsonb_build_object('success', true, 'services_created', 0, 'note', 'No line items');
  END IF;

  v_category := CASE 
    WHEN v_order.service_type ILIKE '%internet%' THEN 'internet'
    WHEN v_order.service_type ILIKE '%tv%' OR v_order.service_type ILIKE '%télé%' THEN 'tv'
    WHEN v_order.service_type ILIKE '%combo%' OR v_order.service_type ILIKE '%bundle%' THEN 'combo'
    WHEN v_order.service_type ILIKE '%mobile%' OR v_order.service_type ILIKE '%cell%' THEN 'mobile'
    ELSE 'other'
  END;

  -- Get account_id
  SELECT id INTO v_account_id FROM accounts WHERE client_id = v_order.user_id LIMIT 1;

  -- Resolve address by hash
  IF v_order.service_address IS NOT NULL THEN
    v_address_hash := public.compute_address_hash(v_order.service_address, v_order.service_city, 'QC', v_order.service_postal_code);

    SELECT id INTO v_address_id FROM service_addresses
    WHERE account_id = v_account_id AND address_hash = v_address_hash AND is_active = true LIMIT 1;

    IF v_address_id IS NULL AND v_account_id IS NOT NULL THEN
      INSERT INTO service_addresses (account_id, label, address_line, city, province, postal_code)
      VALUES (v_account_id, COALESCE(v_order.service_city, 'Adresse'), v_order.service_address, v_order.service_city, 'QC', v_order.service_postal_code)
      RETURNING id INTO v_address_id;
    END IF;
  END IF;

  IF v_category IN ('internet', 'tv', 'combo') AND v_address_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ADDRESS_REQUIRED',
      'message', 'Une adresse de service est requise pour Internet/TV/Combo');
  END IF;

  -- Hash-based duplicate check (catches same address even with different address_id)
  IF v_category IN ('internet', 'tv', 'combo') AND v_address_hash IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM billing_subscriptions bs
      JOIN service_addresses sa ON sa.id = bs.address_id
      WHERE bs.customer_id = v_customer_id
        AND sa.address_hash = v_address_hash
        AND bs.service_category = v_category
        AND bs.status NOT IN ('cancelled', 'expired')
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_SERVICE_AT_ADDRESS',
        'message', 'Un service ' || v_category || ' est déjà actif ou en cours à cette adresse.');
    END IF;
  END IF;

  -- Build + save address snapshot
  IF v_address_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'address_id', sa.id, 'label', sa.label, 'address_line', sa.address_line,
      'city', sa.city, 'province', sa.province, 'postal_code', sa.postal_code,
      'snapshot_at', now()
    ) INTO v_address_snapshot FROM service_addresses sa WHERE sa.id = v_address_id;

    UPDATE billing_invoices SET address_snapshot = v_address_snapshot
    WHERE order_id = p_order_id AND address_snapshot IS NULL;
  END IF;

  -- Idempotent subscription creation
  IF NOT EXISTS (
    SELECT 1 FROM billing_subscriptions WHERE order_id = p_order_id AND customer_id = v_customer_id
  ) THEN
    INSERT INTO billing_subscriptions (
      customer_id, plan_code, plan_name, plan_price,
      cycle_start_date, cycle_end_date, status, order_id, address_id, service_category
    ) VALUES (
      v_customer_id,
      COALESCE(v_order.service_type, 'unknown'),
      COALESCE((v_line_items->0->>'name'), v_order.service_type, 'Service'),
      COALESCE((v_line_items->0->>'price')::numeric, v_order.subtotal, 0),
      CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
      'active', p_order_id, v_address_id, v_category
    ) RETURNING id INTO v_sub_id;
    v_services_created := v_services_created + 1;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_line_items)
    LOOP
      IF (v_item->>'type') IN ('plan', 'service', 'equipment', 'option') THEN
        INSERT INTO billing_subscription_services (
          subscription_id, service_code, service_name, service_type, unit_price, quantity, is_active
        ) VALUES (
          v_sub_id, COALESCE(v_item->>'code', v_item->>'type', 'item'),
          COALESCE(v_item->>'name', 'Service'), COALESCE(v_item->>'type', 'plan'),
          COALESCE((v_item->>'price')::numeric, 0), COALESCE((v_item->>'quantity')::int, 1), true
        ) ON CONFLICT DO NOTHING;
        v_services_created := v_services_created + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'services_created', v_services_created,
    'subscription_id', v_sub_id, 'address_id', v_address_id, 'category', v_category);

EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_SERVICE_AT_ADDRESS',
    'message', 'Un service de cette catégorie est déjà actif ou en cours à cette adresse.');
END;
$$;

-- 12) RLS policies for client access
DROP POLICY IF EXISTS "clients_read_own_addresses" ON public.service_addresses;
CREATE POLICY "clients_read_own_addresses" ON public.service_addresses
  FOR SELECT TO authenticated
  USING (account_id IN (SELECT id FROM accounts WHERE client_id = auth.uid()));

DROP POLICY IF EXISTS "clients_insert_own_addresses" ON public.service_addresses;
CREATE POLICY "clients_insert_own_addresses" ON public.service_addresses
  FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT id FROM accounts WHERE client_id = auth.uid()));

DROP POLICY IF EXISTS "clients_update_own_addresses" ON public.service_addresses;
CREATE POLICY "clients_update_own_addresses" ON public.service_addresses
  FOR UPDATE TO authenticated
  USING (account_id IN (SELECT id FROM accounts WHERE client_id = auth.uid()));
