
-- ─── Slot rules (recurring weekday templates) ───
CREATE TABLE IF NOT EXISTS public.appointment_slot_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=Sun..6=Sat
  start_time time NOT NULL,
  end_time time NOT NULL,
  capacity smallint NOT NULL DEFAULT 2 CHECK (capacity >= 0),
  is_active boolean NOT NULL DEFAULT true,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT slot_rules_time_order CHECK (end_time > start_time),
  CONSTRAINT slot_rules_unique_window UNIQUE (weekday, start_time, end_time)
);

CREATE INDEX IF NOT EXISTS idx_slot_rules_weekday_active
  ON public.appointment_slot_rules (weekday) WHERE is_active;

ALTER TABLE public.appointment_slot_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view slot rules"
  ON public.appointment_slot_rules FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'supervisor')
    OR public.has_role(auth.uid(),'employee')
    OR public.has_role(auth.uid(),'billing_admin')
    OR public.has_role(auth.uid(),'field_sales')
  );

CREATE POLICY "Admins can manage slot rules"
  ON public.appointment_slot_rules FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'));

-- ─── Blocked dates (full-day blackouts) ───
CREATE TABLE IF NOT EXISTS public.appointment_blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocked_date date NOT NULL UNIQUE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.appointment_blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view blocked dates"
  ON public.appointment_blocked_dates FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'supervisor')
    OR public.has_role(auth.uid(),'employee')
    OR public.has_role(auth.uid(),'billing_admin')
    OR public.has_role(auth.uid(),'field_sales')
  );

CREATE POLICY "Admins can manage blocked dates"
  ON public.appointment_blocked_dates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'));

-- ─── Trigger: keep updated_at fresh ───
CREATE TRIGGER trg_slot_rules_updated_at
  BEFORE UPDATE ON public.appointment_slot_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Helper function: returns slots + bookings for a date ───
CREATE OR REPLACE FUNCTION public.get_appointment_slot_availability(p_date date)
RETURNS TABLE (
  rule_id uuid,
  start_time time,
  end_time time,
  capacity smallint,
  bookings_count bigint,
  remaining smallint,
  is_blocked boolean,
  block_reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_weekday smallint := EXTRACT(DOW FROM p_date)::smallint;
  v_blocked_reason text;
  v_is_blocked boolean := false;
BEGIN
  SELECT bd.reason INTO v_blocked_reason
    FROM public.appointment_blocked_dates bd
   WHERE bd.blocked_date = p_date
   LIMIT 1;
  v_is_blocked := FOUND;

  RETURN QUERY
  SELECT
    r.id AS rule_id,
    r.start_time,
    r.end_time,
    r.capacity,
    COALESCE(b.cnt, 0) AS bookings_count,
    GREATEST(0, r.capacity - COALESCE(b.cnt, 0)::smallint)::smallint AS remaining,
    v_is_blocked AS is_blocked,
    v_blocked_reason AS block_reason
  FROM public.appointment_slot_rules r
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt
      FROM public.appointments a
     WHERE a.scheduled_at::date = p_date
       AND (a.scheduled_at::time) >= r.start_time
       AND (a.scheduled_at::time) <  r.end_time
       AND COALESCE(a.status,'') NOT IN ('cancelled','completed','no_show')
  ) b ON TRUE
  WHERE r.weekday = v_weekday
    AND r.is_active = true
  ORDER BY r.start_time;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_appointment_slot_availability(date) TO authenticated;

-- ─── Seed defaults: Monday→Saturday (1..6), 4 slots each, capacity 2 ───
INSERT INTO public.appointment_slot_rules (weekday, start_time, end_time, capacity, label)
SELECT wd, s.start_t, s.end_t, 2, s.lbl
FROM generate_series(1, 6) AS wd
CROSS JOIN (VALUES
  (TIME '08:00', TIME '10:00', '08h00 - 10h00'),
  (TIME '10:00', TIME '12:00', '10h00 - 12h00'),
  (TIME '13:00', TIME '15:00', '13h00 - 15h00'),
  (TIME '15:00', TIME '17:00', '15h00 - 17h00')
) AS s(start_t, end_t, lbl)
ON CONFLICT (weekday, start_time, end_time) DO NOTHING;
