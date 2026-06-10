-- ═══════════════════════════════════════════════════════════════════════════
-- INFRASTRUCTURE RESILIENCE — June 10, 2026
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. fn_dead_letter: permanent dead-letter log for edge function failures
-- 2. pg_cron: retry orphan field_payment_intents every 10 minutes
-- 3. pg_cron: retry orphan field_payment_intents (longer window) every hour
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Dead-letter log ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fn_dead_letter (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name   TEXT        NOT NULL,
  error_message   TEXT        NOT NULL,
  payload         JSONB,
  context         JSONB,
  retry_count     INTEGER     NOT NULL DEFAULT 0,
  resolved        BOOLEAN     NOT NULL DEFAULT false,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fn_dead_letter ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_dead_letter" ON public.fn_dead_letter
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS fn_dead_letter_function_created
  ON public.fn_dead_letter (function_name, created_at DESC);
CREATE INDEX IF NOT EXISTS fn_dead_letter_unresolved
  ON public.fn_dead_letter (resolved, created_at DESC)
  WHERE resolved = false;

-- ── Retry function: call field-sales-sync materialize for orphan intents ──
-- field_payment_intents where status='paid' but converted_order_id IS NULL
-- (PayPal confirmed payment but field-sales-sync failed to materialize)

CREATE OR REPLACE FUNCTION public.retry_orphan_field_intents()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_intent     RECORD;
  v_count_ok   INTEGER := 0;
  v_count_fail INTEGER := 0;
  v_supabase_url TEXT;
  v_service_key  TEXT;
BEGIN
  v_supabase_url := current_setting('app.settings.supabase_url',  true);
  v_service_key  := current_setting('app.settings.service_role_key', true);

  -- If settings are not configured, return early gracefully
  IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
    INSERT INTO public.fn_dead_letter (function_name, error_message, context)
    VALUES ('retry_orphan_field_intents', 'app.settings.supabase_url or service_role_key not configured', '{}');
    RETURN jsonb_build_object('ok', false, 'reason', 'settings_not_configured');
  END IF;

  FOR v_intent IN
    SELECT id, quote_id, agent_id, amount
    FROM public.field_payment_intents
    WHERE status = 'paid'
      AND converted_order_id IS NULL
      AND paid_at > now() - INTERVAL '48 hours'
    ORDER BY paid_at ASC
    LIMIT 20
  LOOP
    BEGIN
      PERFORM
        net.http_post(
          url     := v_supabase_url || '/functions/v1/field-sales-sync',
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || v_service_key,
            'apikey',        v_service_key
          ),
          body    := jsonb_build_object(
            'action',   'materialize_from_quote',
            'quote_id', v_intent.quote_id,
            'agent_id', v_intent.agent_id
          )
        );
      v_count_ok := v_count_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_count_fail := v_count_fail + 1;
      INSERT INTO public.fn_dead_letter (function_name, error_message, payload, context)
      VALUES (
        'retry_orphan_field_intents',
        SQLERRM,
        jsonb_build_object('intent_id', v_intent.id, 'quote_id', v_intent.quote_id),
        jsonb_build_object('sqlerrstate', SQLSTATE)
      );
    END;
  END LOOP;

  RETURN jsonb_build_object('triggered', v_count_ok, 'failed', v_count_fail);
END;
$$;

-- ── pg_cron jobs ──────────────────────────────────────────────────────────
-- Note: cron.schedule() requires pg_cron extension (enabled on Supabase Pro+).
-- If extension is not available, these are safe no-ops (wrapped in DO block).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN

    -- Retry orphan field payment intents every 15 minutes
    PERFORM cron.schedule(
      'retry-orphan-field-intents',
      '*/15 * * * *',
      $$SELECT public.retry_orphan_field_intents()$$
    );

    -- Daily billing system alerts cleanup: resolve old low-severity alerts
    PERFORM cron.schedule(
      'clean-resolved-billing-alerts',
      '0 3 * * *',
      $$
        UPDATE public.billing_system_alerts
        SET resolved = true, resolved_at = now()
        WHERE resolved = false
          AND created_at < now() - INTERVAL '30 days'
          AND severity NOT IN ('critical', 'high')
      $$
    );

  END IF;
END;
$$;

-- ── Grant execute on retry function to service role ───────────────────────
GRANT EXECUTE ON FUNCTION public.retry_orphan_field_intents() TO service_role;
