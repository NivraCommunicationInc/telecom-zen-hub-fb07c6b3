
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coaxial_survey jsonb,
  ADD COLUMN IF NOT EXISTS shipping_fee_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_address_id uuid REFERENCES public.service_addresses(id) ON DELETE SET NULL;

ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS service_address_id uuid REFERENCES public.service_addresses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_billing_subs_service_addr ON public.billing_subscriptions (service_address_id);

CREATE OR REPLACE FUNCTION public.enforce_max_two_service_addresses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.service_addresses
   WHERE account_id = NEW.account_id AND is_active = true;
  IF v_count >= 2 THEN
    RAISE EXCEPTION 'Max 2 adresses de service par compte' USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_max_two_service_addresses ON public.service_addresses;
CREATE TRIGGER trg_max_two_service_addresses
BEFORE INSERT ON public.service_addresses
FOR EACH ROW WHEN (NEW.is_active IS TRUE)
EXECUTE FUNCTION public.enforce_max_two_service_addresses();

INSERT INTO public.field_sales_config (config_key, config_value, config_type, description) VALUES
  ('shipping_fee_cents',      '2000', 'number', 'Frais d''expédition auto-installation (cents)'),
  ('prorata_basis_days',      '30',   'number', 'Base de jours pour le calcul du prorata'),
  ('checkout_draft_ttl_days', '30',   'number', 'Durée de vie d''un brouillon de commande (jours)')
ON CONFLICT (config_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.compute_prorata_base30(p_monthly_price numeric, p_days_remaining integer)
RETURNS numeric
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT round((COALESCE(p_monthly_price,0)/30.0) * GREATEST(0, LEAST(30, COALESCE(p_days_remaining,0))), 2);
$$;
GRANT EXECUTE ON FUNCTION public.compute_prorata_base30(numeric, integer) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_available_installation_slots(p_from_date date, p_to_date date)
RETURNS TABLE(slot_date date, time_slot text, capacity integer, booked integer, available integer, status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_from_date IS NULL OR p_to_date IS NULL THEN RAISE EXCEPTION 'from_date and to_date required'; END IF;
  IF (p_to_date - p_from_date) > 90 THEN p_to_date := p_from_date + 90; END IF;

  RETURN QUERY
  WITH days AS (
    SELECT d::date AS slot_date FROM generate_series(p_from_date, p_to_date, interval '1 day') d
  ),
  rules AS (
    SELECT weekday, start_time, end_time, capacity FROM public.appointment_slot_rules WHERE is_active = true
  ),
  base_slots AS (
    SELECT d.slot_date,
           CONCAT(to_char(r.start_time,'HH24:MI'),'-',to_char(r.end_time,'HH24:MI')) AS time_slot,
           r.capacity::int AS capacity
      FROM days d JOIN rules r ON r.weekday = EXTRACT(DOW FROM d.slot_date)::smallint
     WHERE d.slot_date NOT IN (SELECT blocked_date FROM public.appointment_blocked_dates)
  ),
  with_overrides AS (
    SELECT bs.slot_date, bs.time_slot,
           COALESCE(o.capacity_override, bs.capacity) AS capacity,
           COALESCE(o.status, 'open') AS status
      FROM base_slots bs
      LEFT JOIN public.appointment_slot_overrides o
        ON o.override_date = bs.slot_date AND o.time_slot = bs.time_slot
  ),
  bookings AS (
    SELECT (appointment_date::date) AS slot_date, appointment_window AS time_slot, count(*)::int AS booked
      FROM public.installation_appointments
     WHERE status NOT IN ('cancelled','no_show')
       AND appointment_date::date BETWEEN p_from_date AND p_to_date
     GROUP BY 1,2
  )
  SELECT wo.slot_date, wo.time_slot, wo.capacity,
         COALESCE(b.booked, 0),
         GREATEST(0, wo.capacity - COALESCE(b.booked, 0)),
         CASE WHEN wo.status='closed' THEN 'closed'
              WHEN wo.capacity - COALESCE(b.booked,0) <= 0 THEN 'full'
              ELSE 'open' END
    FROM with_overrides wo LEFT JOIN bookings b USING (slot_date, time_slot)
   WHERE wo.slot_date >= CURRENT_DATE
   ORDER BY wo.slot_date, wo.time_slot;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_available_installation_slots(date, date) TO anon, authenticated, service_role;

ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS draft_data jsonb,
  ADD COLUMN IF NOT EXISTS draft_source text;

ALTER TABLE public.checkout_sessions
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 days');

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_user ON public.checkout_sessions (user_id, updated_at DESC);
