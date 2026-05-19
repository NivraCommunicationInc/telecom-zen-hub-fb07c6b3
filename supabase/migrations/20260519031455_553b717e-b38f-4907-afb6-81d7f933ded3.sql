
CREATE TABLE IF NOT EXISTS public.crm_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  variant text NOT NULL DEFAULT 'A',
  content text NOT NULL,
  weight integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  served_count integer NOT NULL DEFAULT 0,
  conversion_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_scripts_select_authenticated" ON public.crm_scripts
FOR SELECT TO authenticated USING (true);

CREATE POLICY "crm_scripts_admin_manage" ON public.crm_scripts
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.crm_pick_script()
RETURNS TABLE(id uuid, name text, variant text, content text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total integer; pick integer; cum integer := 0; r record;
BEGIN
  SELECT COALESCE(SUM(weight),0) INTO total FROM public.crm_scripts WHERE is_active = true;
  IF total = 0 THEN RETURN; END IF;
  pick := floor(random() * total)::int + 1;
  FOR r IN SELECT s.id, s.name, s.variant, s.content, s.weight
           FROM public.crm_scripts s WHERE s.is_active = true ORDER BY s.created_at
  LOOP
    cum := cum + r.weight;
    IF cum >= pick THEN
      UPDATE public.crm_scripts SET served_count = served_count + 1 WHERE crm_scripts.id = r.id;
      RETURN QUERY SELECT r.id, r.name, r.variant, r.content;
      RETURN;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_optimal_call_hours()
RETURNS TABLE(hour_of_day integer, total_calls bigint, connected bigint, connect_rate numeric)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    EXTRACT(HOUR FROM started_at AT TIME ZONE 'America/Toronto')::int AS hour_of_day,
    COUNT(*) AS total_calls,
    COUNT(*) FILTER (WHERE outcome IN ('answered','sale','callback','interested')) AS connected,
    ROUND((COUNT(*) FILTER (WHERE outcome IN ('answered','sale','callback','interested'))::numeric
           / NULLIF(COUNT(*),0)) * 100, 1) AS connect_rate
  FROM public.crm_call_logs
  WHERE started_at > now() - interval '90 days'
  GROUP BY hour_of_day ORDER BY hour_of_day;
$$;

CREATE OR REPLACE FUNCTION public.crm_manager_dashboard(days integer DEFAULT 7)
RETURNS TABLE(
  agent_id uuid, agent_name text, total_calls bigint, total_sales bigint,
  conversion_rate numeric, avg_duration_seconds numeric, callbacks_pending bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH calls AS (
    SELECT agent_id, COUNT(*) AS total_calls,
           COUNT(*) FILTER (WHERE outcome = 'sale') AS total_sales,
           AVG(duration_seconds) AS avg_dur
    FROM public.crm_call_logs
    WHERE started_at > now() - (days || ' days')::interval
    GROUP BY agent_id
  ),
  cb AS (
    SELECT assigned_to AS agent_id, COUNT(*) AS pending
    FROM public.crm_contacts
    WHERE callback_scheduled_at > now()
    GROUP BY assigned_to
  )
  SELECT
    c.agent_id,
    COALESCE(p.full_name, p.email, 'Agent') AS agent_name,
    COALESCE(c.total_calls, 0),
    COALESCE(c.total_sales, 0),
    CASE WHEN COALESCE(c.total_calls,0) = 0 THEN 0
         ELSE ROUND(COALESCE(c.total_sales,0)::numeric / c.total_calls * 100, 1) END,
    ROUND(COALESCE(c.avg_dur, 0)::numeric, 0),
    COALESCE(cb.pending, 0)
  FROM calls c
  LEFT JOIN cb ON cb.agent_id = c.agent_id
  LEFT JOIN public.profiles p ON p.id = c.agent_id
  ORDER BY COALESCE(c.total_sales,0) DESC, COALESCE(c.total_calls,0) DESC;
$$;

CREATE OR REPLACE FUNCTION public.crm_release_stale_locks()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cnt integer;
BEGIN
  UPDATE public.crm_contacts
  SET is_locked = false, locked_by = NULL, locked_by_name = NULL,
      locked_at = NULL, locked_until = NULL
  WHERE is_locked = true
    AND (locked_until IS NULL OR locked_until < now())
    AND (locked_at IS NULL OR locked_at < now() - interval '15 minutes');
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RETURN cnt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crm_pick_script() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_optimal_call_hours() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_manager_dashboard(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_release_stale_locks() TO authenticated;
