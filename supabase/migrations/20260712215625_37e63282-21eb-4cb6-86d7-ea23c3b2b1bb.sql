CREATE OR REPLACE FUNCTION public.get_appointment_slot_availability(p_date date)
RETURNS TABLE(
  rule_id uuid,
  start_time time without time zone,
  end_time time without time zone,
  capacity smallint,
  bookings_count bigint,
  remaining smallint,
  is_blocked boolean,
  block_reason text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_weekday smallint := EXTRACT(DOW FROM p_date)::smallint;
  v_blocked_reason text;
  v_is_blocked boolean := false;
BEGIN
  -- Jour entier bloqué : même source que le RPC public unifié.
  SELECT bd.reason INTO v_blocked_reason
    FROM public.appointment_blocked_dates bd
   WHERE bd.blocked_date = p_date
   LIMIT 1;
  v_is_blocked := FOUND;

  RETURN QUERY
  WITH rules AS (
    SELECT r.id, r.start_time, r.end_time, r.capacity,
           CONCAT(to_char(r.start_time,'HH24:MI'),'-',to_char(r.end_time,'HH24:MI')) AS time_slot
      FROM public.appointment_slot_rules r
     WHERE r.weekday = v_weekday
       AND r.is_active = true
  ),
  with_overrides AS (
    SELECT r.id, r.start_time, r.end_time, r.time_slot,
           COALESCE(o.capacity_override, r.capacity)::smallint AS effective_capacity,
           COALESCE(o.status, 'open') AS effective_status
      FROM rules r
      LEFT JOIN public.appointment_slot_overrides o
        ON o.override_date = p_date AND o.time_slot = r.time_slot
  ),
  bookings AS (
    SELECT wo.id AS rule_id, COUNT(a.id)::bigint AS cnt
      FROM with_overrides wo
      LEFT JOIN public.appointments a
        ON a.scheduled_at::date = p_date
       AND (a.scheduled_at AT TIME ZONE 'UTC')::time >= wo.start_time
       AND (a.scheduled_at AT TIME ZONE 'UTC')::time <  wo.end_time
       AND COALESCE(a.status,'') NOT IN ('cancelled','completed','no_show')
     GROUP BY wo.id
  )
  SELECT
    wo.id AS rule_id,
    wo.start_time,
    wo.end_time,
    wo.effective_capacity AS capacity,
    COALESCE(b.cnt, 0) AS bookings_count,
    -- Un slot en 'closed' devient effectivement 0 dispo.
    CASE WHEN wo.effective_status = 'closed' THEN 0::smallint
         ELSE GREATEST(0, wo.effective_capacity - COALESCE(b.cnt, 0))::smallint END AS remaining,
    (v_is_blocked OR wo.effective_status = 'closed') AS is_blocked,
    COALESCE(v_blocked_reason,
             CASE WHEN wo.effective_status = 'closed' THEN 'slot_closed_override' ELSE NULL END) AS block_reason
  FROM with_overrides wo
  LEFT JOIN bookings b ON b.rule_id = wo.id
  ORDER BY wo.start_time;
END;
$function$;