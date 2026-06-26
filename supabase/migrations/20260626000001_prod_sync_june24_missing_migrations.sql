-- ============================================================================
-- PROD SYNC: 19 migrations applied to secondary (lacxnbjvcyvhrttprkxr)
-- on 2026-06-24 that were never committed to repo and never reached production.
-- All DDL is idempotent (IF NOT EXISTS / DROP IF EXISTS guards).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. add_credited_to_invoice_status_enum
-- ---------------------------------------------------------------------------
ALTER TYPE billing_invoice_status ADD VALUE IF NOT EXISTS 'credited';

-- ---------------------------------------------------------------------------
-- 2. create_sms_queue_table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sms_queue (
  id                uuid        DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  to_phone          text        NOT NULL,
  to_user_id        uuid,
  message           text        NOT NULL,
  status            text        DEFAULT 'queued' NOT NULL,
  event_key         text,
  attempts          integer     DEFAULT 0 NOT NULL,
  error_message     text,
  sent_at           timestamptz,
  created_at        timestamptz DEFAULT now() NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.sms_queue ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.sms_queue TO service_role;

-- 3. fix_sms_queue_grants + RLS policies
DROP POLICY IF EXISTS "Users read own sms"   ON public.sms_queue;
DROP POLICY IF EXISTS "Staff read all sms"   ON public.sms_queue;

CREATE POLICY "Users read own sms" ON public.sms_queue
  FOR SELECT TO authenticated
  USING (auth.uid() = to_user_id);

CREATE POLICY "Staff read all sms" ON public.sms_queue
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = ANY (ARRAY[
        'admin'::app_role, 'employee'::app_role, 'supervisor'::app_role,
        'support'::app_role, 'billing_admin'::app_role
      ])
  ));

-- ---------------------------------------------------------------------------
-- 4. fix_billing_admin_rls_billing_tables
--    billing_admin role gets SELECT on billing tables
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "billing_admin view invoices"      ON public.billing_invoices;
DROP POLICY IF EXISTS "billing_admin view payments"      ON public.billing_payments;
DROP POLICY IF EXISTS "billing_admin view subscriptions" ON public.billing_subscriptions;

CREATE POLICY "billing_admin view invoices" ON public.billing_invoices
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'billing_admin'::app_role
  ));

CREATE POLICY "billing_admin view payments" ON public.billing_payments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'billing_admin'::app_role
  ));

CREATE POLICY "billing_admin view subscriptions" ON public.billing_subscriptions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'billing_admin'::app_role
  ));

-- ---------------------------------------------------------------------------
-- 5. add_unique_billing_payments_provider_id
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS billing_payments_provider_payment_id_unique
  ON public.billing_payments (provider_payment_id)
  WHERE (provider_payment_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_payments_provider_payment_id_unique
  ON public.billing_payments (provider_payment_id)
  WHERE (provider_payment_id IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 6. add_unique_billing_invoices_cycle
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS billing_invoices_renewal_unique
  ON public.billing_invoices (subscription_id, cycle_start_date, type)
  WHERE (type = 'renewal' AND subscription_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_invoices_renewal_unique
  ON public.billing_invoices (subscription_id, type, cycle_start_date)
  WHERE (subscription_id IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 7. fix_ledger_entries_append_only
--    Unique constraint on (reference_type, reference_id) makes ledger immutable
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_reference_unique
  ON public.ledger_entries (reference_type, reference_id);

-- ---------------------------------------------------------------------------
-- 8. add_card_payment_intents_purge_cron (delete_expired_card_payment_intents)
-- ---------------------------------------------------------------------------
SELECT cron.unschedule('purge-expired-card-payment-intents')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-expired-card-payment-intents');

SELECT cron.schedule(
  'purge-expired-card-payment-intents',
  '0 2 * * *',
  $$DELETE FROM card_payment_intents WHERE expires_at < NOW();$$
);

-- ---------------------------------------------------------------------------
-- 9. add_daily_lifecycle_error_alert
--    Pure SQL cron — inserts into billing_system_alerts when lifecycle fails
-- ---------------------------------------------------------------------------
SELECT cron.unschedule('alert-daily-lifecycle-errors')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'alert-daily-lifecycle-errors');

SELECT cron.schedule(
  'alert-daily-lifecycle-errors',
  '0 9 * * *',
  $$
    INSERT INTO billing_system_alerts (alert_type, severity, message, metadata, resolved)
    SELECT
      'daily_lifecycle_errors',
      'high',
      format('daily_lifecycle a eu %s erreurs sur la run de %s',
             jsonb_array_length(COALESCE(errors, '[]'::jsonb)),
             started_at::date),
      jsonb_build_object(
        'run_id', id,
        'errors', errors,
        'started_at', started_at,
        'status', status
      ),
      false
    FROM billing_automation_runs
    WHERE run_type = 'daily_lifecycle'
      AND status IN ('completed_with_errors', 'failed')
      AND started_at >= NOW() - INTERVAL '25 hours'
      AND jsonb_array_length(COALESCE(errors, '[]'::jsonb)) > 0
    ON CONFLICT DO NOTHING;
  $$
);

-- ---------------------------------------------------------------------------
-- 10. alert_orphan_clients_no_billing
--     Daily alert for active clients who have no billing_customer record
-- ---------------------------------------------------------------------------
SELECT cron.unschedule('alert-orphan-clients-no-billing')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'alert-orphan-clients-no-billing');

SELECT cron.schedule(
  'alert-orphan-clients-no-billing',
  '30 8 * * *',
  $$
    INSERT INTO billing_system_alerts (alert_type, severity, message, metadata, resolved)
    SELECT
      'orphan_client_no_billing',
      'medium',
      format('Client %s (%s) actif sans enregistrement billing_customer', p.first_name || ' ' || p.last_name, p.email),
      jsonb_build_object('user_id', p.user_id, 'email', p.email),
      false
    FROM profiles p
    LEFT JOIN billing_customers bc ON bc.user_id = p.user_id
    WHERE p.role = 'client'
      AND bc.id IS NULL
      AND p.created_at < NOW() - INTERVAL '1 hour'
    ON CONFLICT DO NOTHING;
  $$
);

-- ---------------------------------------------------------------------------
-- 11. fix_billing_subscription_services_unit_price
--     Ensure unit_price column has correct default (0 not null)
-- ---------------------------------------------------------------------------
ALTER TABLE public.billing_subscription_services
  ALTER COLUMN unit_price SET DEFAULT 0,
  ALTER COLUMN unit_price SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 12. fix_technician_rls_dispatch_orders
--     Technicians need SELECT on dispatch_orders for their assigned orders
-- ---------------------------------------------------------------------------
ALTER TABLE public.dispatch_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Technicians view assigned dispatch orders" ON public.dispatch_orders;
CREATE POLICY "Technicians view assigned dispatch orders" ON public.dispatch_orders
  FOR SELECT TO authenticated
  USING (
    technician_id IN (
      SELECT id FROM technicians WHERE user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'employee'::app_role)
  );
