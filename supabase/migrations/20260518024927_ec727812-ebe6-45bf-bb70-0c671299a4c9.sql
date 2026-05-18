-- Pause columns on subscriptions
ALTER TABLE public.billing_subscriptions
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pause_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pause_reason TEXT;

-- Pause duration on suspension_requests
ALTER TABLE public.suspension_requests
  ADD COLUMN IF NOT EXISTS pause_duration_days INTEGER;

-- Client self-serve RLS on suspension_requests
DROP POLICY IF EXISTS "Clients can create own suspension requests" ON public.suspension_requests;
CREATE POLICY "Clients can create own suspension requests"
ON public.suspension_requests
FOR INSERT
TO authenticated
WITH CHECK (client_id = auth.uid());

DROP POLICY IF EXISTS "Clients can view own suspension requests" ON public.suspension_requests;
CREATE POLICY "Clients can view own suspension requests"
ON public.suspension_requests
FOR SELECT
TO authenticated
USING (client_id = auth.uid());

-- Client-callable RPC: resume my own paused service immediately
CREATE OR REPLACE FUNCTION public.client_resume_paused_service(p_subscription_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT bc.user_id INTO v_owner
  FROM public.billing_subscriptions bs
  JOIN public.billing_customers bc ON bc.id = bs.customer_id
  WHERE bs.id = p_subscription_id;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to resume this subscription';
  END IF;

  UPDATE public.billing_subscriptions
  SET status = 'active',
      paused_at = NULL,
      pause_until = NULL,
      pause_reason = NULL
  WHERE id = p_subscription_id;

  UPDATE public.suspension_requests
  SET status = 'completed', processed_at = now()
  WHERE subscription_id = p_subscription_id
    AND status IN ('approved', 'pending');
END;
$$;

REVOKE ALL ON FUNCTION public.client_resume_paused_service(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_resume_paused_service(uuid) TO authenticated;

-- Auto-resume function called by daily cron
CREATE OR REPLACE FUNCTION public.auto_resume_paused_services()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  r record;
BEGIN
  FOR r IN
    SELECT bs.id AS sub_id, bs.plan_name, bc.email, bc.user_id
    FROM public.billing_subscriptions bs
    JOIN public.billing_customers bc ON bc.id = bs.customer_id
    WHERE bs.status = 'paused'
      AND bs.pause_until IS NOT NULL
      AND bs.pause_until <= now()
  LOOP
    UPDATE public.billing_subscriptions
    SET status = 'active',
        paused_at = NULL,
        pause_until = NULL,
        pause_reason = NULL
    WHERE id = r.sub_id;

    UPDATE public.suspension_requests
    SET status = 'completed', processed_at = now()
    WHERE subscription_id = r.sub_id AND status = 'approved';

    IF r.email IS NOT NULL THEN
      INSERT INTO public.email_queue (
        to_email, template_key, event_key, message_type, template_vars
      ) VALUES (
        r.email,
        'service_resumed',
        'service_resumed',
        'transactional',
        jsonb_build_object(
          'plan_name', COALESCE(r.plan_name, ''),
          'resumed_at', to_char(now() AT TIME ZONE 'America/Toronto', 'YYYY-MM-DD')
        )
      );
    END IF;

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_resume_paused_services() FROM PUBLIC;

-- Schedule daily cron at 06:00 UTC
DO $$
BEGIN
  PERFORM cron.unschedule('auto-resume-paused-services');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'auto-resume-paused-services',
  '0 6 * * *',
  $$ SELECT public.auto_resume_paused_services(); $$
);