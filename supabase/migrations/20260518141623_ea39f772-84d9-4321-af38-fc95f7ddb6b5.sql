CREATE OR REPLACE FUNCTION public.trg_paypal_sync_on_pause_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_url CONSTANT TEXT := 'https://lacxnbjvcyvhrttprkxr.supabase.co/functions/v1/paypal-sync-subscription-state';
  v_anon_key CONSTANT TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0Z25nbXR4Z2dhc2NieG5zd3ZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMDE2MzYsImV4cCI6MjA4MjY3NzYzNn0.BYQ3k1-N2_bbXCRTRcJ6FWoI6HuDP6BdhSrmCYhJai8';
BEGIN
  IF NEW.paypal_subscription_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF (OLD.paused_at IS NULL AND NEW.paused_at IS NOT NULL) THEN
    v_action := 'suspend';
  ELSIF (OLD.paused_at IS NOT NULL AND NEW.paused_at IS NULL) THEN
    v_action := 'activate';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_anon_key,
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := jsonb_build_object(
      'subscription_id', NEW.id,
      'action', v_action,
      'reason', COALESCE(NEW.pause_reason, CASE WHEN v_action = 'suspend' THEN 'Service paused' ELSE 'Service resumed' END)
    )
  );

  RETURN NEW;
END;
$$;