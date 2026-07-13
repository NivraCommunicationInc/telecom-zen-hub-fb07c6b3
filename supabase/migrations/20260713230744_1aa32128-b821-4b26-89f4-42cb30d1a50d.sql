CREATE OR REPLACE FUNCTION public.get_available_installation_slots(p_from_date date, p_to_date date)
 RETURNS TABLE(slot_date date, time_slot text, capacity integer, booked integer, available integer, status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_from_date IS NULL OR p_to_date IS NULL THEN RAISE EXCEPTION 'from_date and to_date required'; END IF;
  IF (p_to_date - p_from_date) > 90 THEN p_to_date := p_from_date + 90; END IF;

  RETURN QUERY
  WITH days AS (
    SELECT d::date AS slot_date FROM generate_series(p_from_date, p_to_date, interval '1 day') d
  ),
  rules AS (
    SELECT r.weekday, r.start_time, r.end_time, r.capacity::int AS rule_capacity
      FROM public.appointment_slot_rules r
     WHERE r.is_active = true
  ),
  base_slots AS (
    SELECT d.slot_date,
           r.start_time,
           r.end_time,
           CONCAT(to_char(r.start_time,'HH24:MI'),'-',to_char(r.end_time,'HH24:MI')) AS time_slot,
           r.rule_capacity AS rule_capacity
      FROM days d JOIN rules r ON r.weekday = EXTRACT(DOW FROM d.slot_date)::smallint
     WHERE d.slot_date NOT IN (SELECT blocked_date FROM public.appointment_blocked_dates)
  ),
  with_overrides AS (
    SELECT bs.slot_date, bs.start_time, bs.end_time, bs.time_slot,
           COALESCE(o.capacity_override, bs.rule_capacity) AS effective_capacity,
           COALESCE(o.status, 'open') AS effective_status
      FROM base_slots bs
      LEFT JOIN public.appointment_slot_overrides o
        ON o.override_date = bs.slot_date AND o.time_slot = bs.time_slot
  ),
  bookings AS (
    -- Non-terminal appointments always occupy the slot, even if scheduled_at is in the past.
    -- Terminal statuses (cancelled, no_show, missed, completed) free the slot.
    SELECT wo.slot_date, wo.time_slot, count(a.id)::int AS booked
      FROM with_overrides wo
      LEFT JOIN public.appointments a
        ON a.scheduled_at::date = wo.slot_date
       AND (a.scheduled_at AT TIME ZONE 'UTC')::time >= wo.start_time
       AND (a.scheduled_at AT TIME ZONE 'UTC')::time <  wo.end_time
       AND COALESCE(a.status,'') NOT IN ('cancelled','no_show','completed','missed')
     GROUP BY wo.slot_date, wo.time_slot
  )
  SELECT wo.slot_date,
         wo.time_slot,
         wo.effective_capacity,
         COALESCE(b.booked, 0),
         GREATEST(0, wo.effective_capacity - COALESCE(b.booked, 0)),
         CASE WHEN wo.effective_status='closed' THEN 'closed'
              WHEN wo.effective_capacity - COALESCE(b.booked,0) <= 0 THEN 'full'
              ELSE 'open' END
    FROM with_overrides wo LEFT JOIN bookings b USING (slot_date, time_slot)
   WHERE wo.slot_date >= CURRENT_DATE
   ORDER BY wo.slot_date, wo.time_slot;
END;
$function$;