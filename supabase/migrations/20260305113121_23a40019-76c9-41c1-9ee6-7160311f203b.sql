-- ============================================================
-- PHASE 2: BILLING INTEGRITY, PROVISIONING GUARDS, CONSTRAINTS
-- ============================================================

-- 1. ATOMIC INVOICE CREATION FUNCTION (invoice + lines in one transaction)
CREATE OR REPLACE FUNCTION public.create_invoice_with_lines(
  p_subscription_id uuid,
  p_customer_id uuid,
  p_invoice_number text,
  p_type text,
  p_subtotal numeric,
  p_tps_amount numeric,
  p_tvq_amount numeric,
  p_total numeric,
  p_payment_method text DEFAULT 'interac',
  p_cycle_start date DEFAULT CURRENT_DATE,
  p_cycle_end date DEFAULT (CURRENT_DATE + 30),
  p_due_date date DEFAULT (CURRENT_DATE + 30),
  p_order_id uuid DEFAULT NULL,
  p_lines jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_line jsonb;
BEGIN
  -- Validate at least one line
  IF jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'INVOICE_REQUIRES_LINES: Cannot create invoice without line items';
  END IF;

  -- Create invoice
  INSERT INTO billing_invoices (
    subscription_id, customer_id, invoice_number, type,
    subtotal, tps_amount, tvq_amount, total,
    payment_method, cycle_start_date, cycle_end_date,
    due_date, order_id, status, currency
  ) VALUES (
    p_subscription_id, p_customer_id, p_invoice_number, p_type::billing_invoice_type,
    p_subtotal, p_tps_amount, p_tvq_amount, p_total,
    p_payment_method::billing_payment_method, p_cycle_start, p_cycle_end,
    p_due_date, p_order_id, 'pending', 'CAD'
  ) RETURNING id INTO v_invoice_id;

  -- Create all lines atomically
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO billing_invoice_lines (
      invoice_id, description, unit_price, quantity, line_total, line_type
    ) VALUES (
      v_invoice_id,
      v_line->>'description',
      (v_line->>'unit_price')::numeric,
      COALESCE((v_line->>'quantity')::int, 1),
      (v_line->>'line_total')::numeric,
      COALESCE(v_line->>'line_type', 'service')
    );
  END LOOP;

  RETURN v_invoice_id;
END;
$$;

-- 2. PROVISIONING GUARD: Block activation without valid invoice
CREATE OR REPLACE FUNCTION public.trg_guard_provisioning_requires_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_exists boolean;
BEGIN
  -- Only check when transitioning TO active status
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    -- Check if order_id has a valid invoice
    IF NEW.order_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM billing_invoices
        WHERE order_id = NEW.order_id
        AND status NOT IN ('void', 'cancelled')
      ) INTO v_invoice_exists;

      IF NOT v_invoice_exists THEN
        RAISE EXCEPTION 'PROVISIONING_BLOCKED: No valid invoice exists for order_id %. Cannot activate service without invoice.', NEW.order_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_provisioning_requires_invoice ON public.billing_subscriptions;
CREATE TRIGGER trg_guard_provisioning_requires_invoice
  BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_guard_provisioning_requires_invoice();

-- 3. TRIGGER: Auto-sync last_invoice_id on billing_invoices insert/update
CREATE OR REPLACE FUNCTION public.trg_sync_last_invoice_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.subscription_id IS NOT NULL AND NEW.status NOT IN ('void', 'cancelled') THEN
    UPDATE billing_subscriptions
    SET last_invoice_id = NEW.id, updated_at = NOW()
    WHERE id = NEW.subscription_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_last_invoice_id ON public.billing_invoices;
CREATE TRIGGER trg_sync_last_invoice_id
  AFTER INSERT OR UPDATE ON public.billing_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_last_invoice_id();

-- 4. BACKFILL: last_invoice_id for existing subscriptions
UPDATE billing_subscriptions bs
SET last_invoice_id = sub.latest_invoice_id, updated_at = NOW()
FROM (
  SELECT DISTINCT ON (subscription_id)
    subscription_id,
    id AS latest_invoice_id
  FROM billing_invoices
  WHERE subscription_id IS NOT NULL
    AND status NOT IN ('void', 'cancelled')
  ORDER BY subscription_id, created_at DESC
) sub
WHERE bs.id = sub.subscription_id
  AND bs.last_invoice_id IS NULL;

-- 5. TRIGGER: Validate invoice always has lines (on status change from pending)
CREATE OR REPLACE FUNCTION public.trg_validate_invoice_has_lines()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line_count int;
BEGIN
  -- Check when invoice moves to a non-draft status
  IF NEW.status IN ('unpaid', 'paid', 'partially_paid') AND
     (OLD.status IS NULL OR OLD.status = 'pending') THEN
    SELECT COUNT(*) INTO v_line_count
    FROM billing_invoice_lines WHERE invoice_id = NEW.id;

    IF v_line_count = 0 THEN
      RAISE EXCEPTION 'INVOICE_NO_LINES: Invoice % has no line items. Cannot finalize.', NEW.invoice_number;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_invoice_has_lines ON public.billing_invoices;
CREATE TRIGGER trg_validate_invoice_has_lines
  BEFORE UPDATE ON public.billing_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_validate_invoice_has_lines();

-- 6. LOG RETENTION POLICY: Auto-cleanup old logs (> 90 days for attempts, > 365 days for audit)
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Rate limit attempts: 7 days
  DELETE FROM rate_limit_attempts WHERE created_at < NOW() - INTERVAL '7 days';

  -- Rate limit lockouts: 7 days
  DELETE FROM rate_limit_lockouts WHERE created_at < NOW() - INTERVAL '7 days';

  -- Admin OTP codes (expired): 30 days
  DELETE FROM admin_otp_codes WHERE expires_at < NOW() - INTERVAL '30 days';

  -- Admin audit sessions (expired): 90 days
  DELETE FROM admin_audit_sessions WHERE expires_at < NOW() - INTERVAL '90 days';

  -- Email queue (sent): 90 days
  DELETE FROM email_queue WHERE status = 'sent' AND updated_at < NOW() - INTERVAL '90 days';

  -- Activity logs: 365 days
  DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL '365 days';

  -- Admin notification logs: 365 days
  DELETE FROM admin_notification_logs WHERE created_at < NOW() - INTERVAL '365 days';
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_logs() IS 'Data retention policy: rate_limit=7d, otp=30d, audit_sessions=90d, sent_emails=90d, activity_logs=365d, notification_logs=365d. Schedule via pg_cron daily.';

-- 7. SENSITIVE DATA ISOLATION: Create order_identity_data table for PII
CREATE TABLE IF NOT EXISTS public.order_identity_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  id_type text,
  id_number_encrypted text,
  id_expiry date,
  verification_status text DEFAULT 'pending',
  verified_at timestamptz,
  verified_by uuid,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(order_id)
);

ALTER TABLE public.order_identity_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_identity_data" ON public.order_identity_data
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "deny_anon_identity_data" ON public.order_identity_data
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 8. Fix search_path on trg_block_credit_class_update
CREATE OR REPLACE FUNCTION public.trg_block_credit_class_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.credit_class IS DISTINCT FROM NEW.credit_class THEN
    IF NOT (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'employee'::public.app_role)
    ) THEN
      RAISE EXCEPTION 'CREDIT_CLASS_UPDATE_DENIED: Only staff can modify credit_class';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;