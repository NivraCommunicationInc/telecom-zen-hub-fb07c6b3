CREATE OR REPLACE FUNCTION public.fn_notify_business_on_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_amount numeric;
  v_client_name text;
  v_client_email text;
  v_client_phone text;
  v_plan_name text;
  v_address text;
  v_source text;
  v_subject text;
  v_html text;
BEGIN
  -- Resolve canonical amount
  v_amount := COALESCE(
    NULLIF((NEW.pricing_snapshot->>'grand_total')::numeric, 0),
    NULLIF(NEW.total_amount, 0),
    0
  );

  -- Resolve client info from profiles via account
  SELECT
    COALESCE(p.full_name, COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,''), 'Client'),
    COALESCE(p.email, NEW.client_email, ''),
    COALESCE(p.phone, '')
  INTO v_client_name, v_client_email, v_client_phone
  FROM public.accounts a
  LEFT JOIN public.profiles p ON p.user_id = a.client_id
  WHERE a.id = NEW.account_id
  LIMIT 1;

  v_plan_name := COALESCE(
    NEW.pricing_snapshot->>'plan_name',
    NEW.service_type,
    'Service'
  );

  v_address := COALESCE(
    NEW.shipping_address || ', ' || COALESCE(NEW.shipping_city,'') || ' ' || COALESCE(NEW.shipping_postal_code,''),
    'Adresse non spécifiée'
  );

  v_source := COALESCE(NEW.created_by, 'inconnu');

  v_subject := '🛒 Nouvelle commande — ' || COALESCE(v_client_name, 'Client') ||
               ' — ' || to_char(v_amount, 'FM999999.00') || '$';

  v_html := '<h2>Nouvelle commande Nivra</h2>' ||
    '<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">' ||
    '<tr><td><strong>Client:</strong></td><td>' || COALESCE(v_client_name,'') || '</td></tr>' ||
    '<tr><td><strong>Courriel:</strong></td><td>' || COALESCE(v_client_email,'') || '</td></tr>' ||
    '<tr><td><strong>Téléphone:</strong></td><td>' || COALESCE(v_client_phone,'') || '</td></tr>' ||
    '<tr><td><strong>Adresse de service:</strong></td><td>' || v_address || '</td></tr>' ||
    '<tr><td><strong>Forfait:</strong></td><td>' || v_plan_name || '</td></tr>' ||
    '<tr><td><strong>Montant:</strong></td><td>' || to_char(v_amount,'FM999999.00') || ' $ CAD</td></tr>' ||
    '<tr><td><strong>Numéro commande:</strong></td><td>' || COALESCE(NEW.order_number, NEW.id::text) || '</td></tr>' ||
    '<tr><td><strong>Réf paiement:</strong></td><td>' || COALESCE(NEW.payment_reference,'n/a') || '</td></tr>' ||
    '<tr><td><strong>Source:</strong></td><td>' || v_source || '</td></tr>' ||
    '<tr><td><strong>Horodatage:</strong></td><td>' || to_char(NEW.created_at, 'YYYY-MM-DD HH24:MI:SS TZ') || '</td></tr>' ||
    '</table>';

  -- Idempotent insert via event_key uniqueness check
  INSERT INTO public.email_queue (event_key, to_email, template_key, subject, template_vars, status, attempts, max_attempts)
  SELECT 'new_order_notify_' || NEW.id::text || '_support', 'support@nivra-telecom.ca', 'custom_html',
         v_subject, jsonb_build_object('subject', v_subject, 'html', v_html), 'queued', 0, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.email_queue
    WHERE event_key = 'new_order_notify_' || NEW.id::text || '_support'
  );

  INSERT INTO public.email_queue (event_key, to_email, template_key, subject, template_vars, status, attempts, max_attempts)
  SELECT 'new_order_notify_' || NEW.id::text || '_alt', 'nivratelecom@gmail.com', 'custom_html',
         v_subject, jsonb_build_object('subject', v_subject, 'html', v_html), 'queued', 0, 5
  WHERE NOT EXISTS (
    SELECT 1 FROM public.email_queue
    WHERE event_key = 'new_order_notify_' || NEW.id::text || '_alt'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block order creation on email failure
  RAISE WARNING '[notify_business_on_new_order] failed for order %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_business_on_new_order ON public.orders;
CREATE TRIGGER trg_notify_business_on_new_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_business_on_new_order();

-- Schedule daily health check via pg_cron (catch-up at 06:00 UTC = 02:00 EDT)
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule('nivra-health-check') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname='nivra-health-check'
    );
    PERFORM cron.schedule(
      'nivra-health-check',
      '0 6 * * *',
      $job$
        SELECT net.http_post(
          url := 'https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/nivra-health-check',
          headers := jsonb_build_object('Content-Type','application/json'),
          body := '{}'::jsonb
        );
      $job$
    );
  END IF;
END
$cron$;