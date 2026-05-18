
CREATE OR REPLACE FUNCTION public.notify_upcoming_maintenance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_incident RECORD;
  v_profiles RECORD;
BEGIN
  FOR v_incident IN
    SELECT * FROM public.service_incidents
    WHERE maintenance_type = 'planned'
      AND notify_clients = true
      AND notification_sent_at IS NULL
      AND scheduled_start_at BETWEEN now() + INTERVAL '23 hours'
                                 AND now() + INTERVAL '25 hours'
  LOOP
    FOR v_profiles IN
      SELECT DISTINCT p.email, p.user_id, p.full_name, p.preferred_language
      FROM public.profiles p
      JOIN public.billing_customers bc ON bc.user_id = p.user_id
      JOIN public.billing_subscriptions bs ON bs.customer_id = bc.id
      WHERE bs.status = 'active'
        AND p.email IS NOT NULL
    LOOP
      INSERT INTO public.email_queue (
        event_key, to_email, template_key, template_vars, language, status
      ) VALUES (
        'maintenance_' || v_incident.id || '_' || v_profiles.user_id,
        v_profiles.email,
        'maintenance_notification',
        jsonb_build_object(
          'client_name', v_profiles.full_name,
          'scheduled_start_at', v_incident.scheduled_start_at,
          'scheduled_end_at', v_incident.scheduled_end_at,
          'maintenance_type', v_incident.maintenance_type,
          'incident_title', v_incident.incident_title,
          'incident_message', v_incident.incident_message
        ),
        COALESCE(v_profiles.preferred_language, 'fr'),
        'queued'
      ) ON CONFLICT (event_key) DO NOTHING;
    END LOOP;

    UPDATE public.service_incidents
    SET notification_sent_at = now()
    WHERE id = v_incident.id;
  END LOOP;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('maintenance-advance-notice');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'maintenance-advance-notice',
  '0 * * * *',
  $cron$ SELECT public.notify_upcoming_maintenance(); $cron$
);
