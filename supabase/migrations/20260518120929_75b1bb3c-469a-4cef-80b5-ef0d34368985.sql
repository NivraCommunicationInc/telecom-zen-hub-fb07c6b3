
-- ========= FEATURE 1: Inventory low stock alerts =========
ALTER TABLE public.inventory_stock
  ADD COLUMN IF NOT EXISTS min_stock_threshold INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS reorder_point INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS last_alert_sent_at TIMESTAMPTZ;

CREATE OR REPLACE VIEW public.inventory_stock_levels
WITH (security_invoker=on) AS
SELECT
  sku,
  MAX(brand) AS brand,
  MAX(model) AS model,
  MAX(item_type) AS item_type,
  MAX(warehouse_location) AS warehouse_location,
  COUNT(*) FILTER (WHERE status = 'in_stock')   AS available_count,
  COUNT(*) FILTER (WHERE status = 'reserved')   AS reserved_count,
  COUNT(*) FILTER (WHERE status = 'assigned')   AS assigned_count,
  COUNT(*) AS total_count,
  MAX(COALESCE(min_stock_threshold, 5))  AS min_stock_threshold,
  MAX(COALESCE(reorder_point, 10))       AS reorder_point,
  MAX(last_alert_sent_at)                AS last_alert_sent_at,
  CASE
    WHEN COUNT(*) FILTER (WHERE status = 'in_stock') = 0 THEN 'out_of_stock'
    WHEN COUNT(*) FILTER (WHERE status = 'in_stock') <= MAX(COALESCE(min_stock_threshold,5)) THEN 'critical'
    WHEN COUNT(*) FILTER (WHERE status = 'in_stock') <= MAX(COALESCE(reorder_point,10)) THEN 'low'
    ELSE 'ok'
  END AS stock_status
FROM public.inventory_stock
WHERE sku IS NOT NULL
GROUP BY sku;

-- ========= FEATURE 2: Referral auto-reward trigger =========
CREATE OR REPLACE FUNCTION public.fn_auto_issue_referral_reward()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward NUMERIC;
  v_user_id UUID;
  v_email TEXT;
  v_name TEXT;
BEGIN
  IF NEW.status = 'reward_pending'
     AND (OLD.status IS DISTINCT FROM 'reward_pending')
     AND (OLD.status IS DISTINCT FROM 'reward_issued') THEN

    SELECT COALESCE(reward_amount, 25)::numeric INTO v_reward
    FROM public.referral_program_settings LIMIT 1;
    v_reward := COALESCE(v_reward, 25);

    -- Resolve influencer to a profile (referral_codes.created_by or influencers.user_id)
    SELECT i.user_id INTO v_user_id
    FROM public.influencers i WHERE i.id = NEW.influencer_id LIMIT 1;

    IF v_user_id IS NOT NULL THEN
      SELECT email, COALESCE(first_name || ' ' || last_name, email)
      INTO v_email, v_name
      FROM public.profiles WHERE user_id = v_user_id LIMIT 1;

      IF v_email IS NOT NULL THEN
        INSERT INTO public.email_queue (
          event_key, to_email, template_key, template_vars, status
        ) VALUES (
          'referral_reward_' || NEW.id::text,
          v_email,
          'referral_reward_issued',
          jsonb_build_object(
            'client_name', COALESCE(v_name, ''),
            'reward_amount', v_reward,
            'language', 'fr'
          ),
          'queued'
        )
        ON CONFLICT (event_key) DO NOTHING;
      END IF;
    END IF;

    NEW.status := 'reward_issued';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_referral_reward ON public.referral_attributions;
CREATE TRIGGER trg_auto_referral_reward
BEFORE UPDATE ON public.referral_attributions
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_issue_referral_reward();

-- ========= FEATURE 4: Maintenance notifications =========
ALTER TABLE public.service_incidents
  ADD COLUMN IF NOT EXISTS notify_clients BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS maintenance_type TEXT DEFAULT 'unplanned';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'service_incidents_maintenance_type_check'
  ) THEN
    ALTER TABLE public.service_incidents
      ADD CONSTRAINT service_incidents_maintenance_type_check
      CHECK (maintenance_type IN ('planned','unplanned','emergency'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.notify_upcoming_maintenance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_incident RECORD;
  v_url TEXT;
  v_key TEXT;
BEGIN
  v_url := 'https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/notify-maintenance';
  v_key := current_setting('app.service_role_key', true);

  FOR v_incident IN
    SELECT id FROM public.service_incidents
    WHERE maintenance_type = 'planned'
      AND notify_clients = true
      AND notification_sent_at IS NULL
      AND scheduled_start_at BETWEEN now() + INTERVAL '23 hours' AND now() + INTERVAL '25 hours'
  LOOP
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(v_key, '')
      ),
      body := jsonb_build_object('incident_id', v_incident.id)::jsonb
    );
    UPDATE public.service_incidents
      SET notification_sent_at = now()
      WHERE id = v_incident.id;
  END LOOP;
END;
$$;
