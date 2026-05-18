-- Trigger function that calls paypal-sync-subscription-state when pause state changes
CREATE OR REPLACE FUNCTION public.trg_paypal_sync_on_pause_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_url TEXT;
  v_anon_key TEXT;
BEGIN
  -- Only act if there's a PayPal binding
  IF NEW.paypal_subscription_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Detect pause/resume transitions
  IF (OLD.paused_at IS NULL AND NEW.paused_at IS NOT NULL) THEN
    v_action := 'suspend';
  ELSIF (OLD.paused_at IS NOT NULL AND NEW.paused_at IS NULL) THEN
    v_action := 'activate';
  ELSE
    RETURN NEW;
  END IF;

  -- Read endpoint config from app GUC (set in same migration)
  BEGIN
    v_url := current_setting('app.functions_url', true);
    v_anon_key := current_setting('app.anon_key', true);
  EXCEPTION WHEN OTHERS THEN
    v_url := NULL;
  END;

  IF v_url IS NULL OR v_anon_key IS NULL THEN
    RAISE WARNING '[paypal_sync] Missing app.functions_url / app.anon_key, skipping';
    RETURN NEW;
  END IF;

  -- Async HTTP call via pg_net (non-blocking)
  PERFORM net.http_post(
    url := v_url || '/paypal-sync-subscription-state',
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

DROP TRIGGER IF EXISTS trg_paypal_sync_on_pause ON public.billing_subscriptions;

CREATE TRIGGER trg_paypal_sync_on_pause
AFTER UPDATE OF paused_at ON public.billing_subscriptions
FOR EACH ROW
WHEN (OLD.paused_at IS DISTINCT FROM NEW.paused_at)
EXECUTE FUNCTION public.trg_paypal_sync_on_pause_change();

COMMENT ON FUNCTION public.trg_paypal_sync_on_pause_change() IS
  'Bug #23: Keeps PayPal subscription state (SUSPEND/ACTIVATE) in sync with billing_subscriptions.paused_at to prevent double-billing during service pauses.';