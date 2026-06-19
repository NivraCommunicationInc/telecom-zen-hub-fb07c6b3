-- ============================================================================
-- BUG N14 — Deploy all PDF auto-triggers + 4 new triggers
--
-- Root cause: information_schema.triggers showed 0 rows for doc_* — the
-- original migration 20260421040527 was tracked but triggers were never live.
--
-- This migration (re-)deploys all 17 existing doc_ triggers and adds:
--   - welcome_letter on orders.UPDATE (activation path)
--   - suspension_notice on billing_subscriptions.UPDATE (billing-lifecycle path)
--   - reactivation_notice on billing_subscriptions.UPDATE
--   - credit_note on account_adjustments.INSERT
-- ============================================================================

-- ============================================================================
-- HELPER: _build_doc_client_payload (unchanged from 20260421040527)
-- ============================================================================
CREATE OR REPLACE FUNCTION public._build_doc_client_payload(
  p_client_id uuid,
  p_account_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile RECORD;
  v_account RECORD;
BEGIN
  SELECT first_name, last_name, full_name, email, phone,
         service_address, service_city, service_province, service_postal_code,
         account_number, client_number
    INTO v_profile
  FROM public.profiles
  WHERE user_id = p_client_id;

  IF p_account_id IS NOT NULL THEN
    SELECT account_number, account_name,
           billing_address, billing_city, billing_province, billing_postal_code,
           primary_service_address, primary_service_city, primary_service_province, primary_service_postal_code
      INTO v_account
    FROM public.accounts
    WHERE id = p_account_id;
  END IF;

  RETURN jsonb_build_object(
    'client_id',     p_client_id,
    'account_id',    p_account_id,
    'first_name',    v_profile.first_name,
    'last_name',     v_profile.last_name,
    'full_name',     COALESCE(v_profile.full_name,
                              NULLIF(TRIM(COALESCE(v_profile.first_name,'') || ' ' || COALESCE(v_profile.last_name,'')), '')),
    'email',         v_profile.email,
    'phone',         v_profile.phone,
    'account_number', COALESCE(v_account.account_number, v_profile.account_number, v_profile.client_number),
    'billing_address', jsonb_build_object(
      'street',      v_account.billing_address,
      'city',        v_account.billing_city,
      'province',    v_account.billing_province,
      'postal_code', v_account.billing_postal_code
    ),
    'service_address', jsonb_build_object(
      'street',      COALESCE(v_account.primary_service_address, v_profile.service_address),
      'city',        COALESCE(v_account.primary_service_city, v_profile.service_city),
      'province',    COALESCE(v_account.primary_service_province, v_profile.service_province),
      'postal_code', COALESCE(v_account.primary_service_postal_code, v_profile.service_postal_code)
    )
  );
END; $$;

-- ============================================================================
-- 1) WELCOME LETTER — accounts.INSERT (latest version from 20260615220001)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_doc_welcome_letter()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email      text;
  v_payload    jsonb;
  v_plan_name  text;
  v_plan_price numeric;
BEGIN
  SELECT email INTO v_email FROM public.profiles WHERE user_id = NEW.client_id;

  SELECT COALESCE(o.plan_name, o.service_name),
         COALESCE(o.plan_price, o.monthly_amount, o.total_amount)
    INTO v_plan_name, v_plan_price
  FROM public.orders o
  WHERE o.user_id = NEW.client_id
  ORDER BY o.created_at DESC LIMIT 1;

  IF v_plan_name IS NULL THEN
    SELECT bs.plan_name, bs.plan_price
      INTO v_plan_name, v_plan_price
    FROM public.billing_customers bc
    JOIN public.billing_subscriptions bs ON bs.customer_id = bc.id
    WHERE bc.email = v_email
    ORDER BY bs.created_at DESC LIMIT 1;
  END IF;

  v_payload := public._build_doc_client_payload(NEW.client_id, NEW.id)
    || jsonb_build_object(
        'letter_number',  'BVN-' || to_char(NEW.created_at, 'YYYYMMDD') || '-' || SUBSTRING(NEW.id::text, 1, 8),
        'created_at',     NEW.created_at,
        'service_name',   COALESCE(v_plan_name, ''),
        'plan_name',      COALESCE(v_plan_name, ''),
        'monthly_amount', COALESCE(v_plan_price, 0),
        'plan_price',     COALESCE(v_plan_price, 0)
    );

  PERFORM public.enqueue_document_job(
    NEW.id, NEW.client_id, 'welcome_letter', 'account.created',
    'welcome_letter::' || NEW.id::text, v_email, v_payload
  );
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS doc_welcome_letter_on_account ON public.accounts;
CREATE TRIGGER doc_welcome_letter_on_account
  AFTER INSERT ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.trg_doc_welcome_letter();

-- 1b) WELCOME LETTER — orders.UPDATE to 'activated' / 'completed' / 'delivered'
--     Idempotency key includes order id to fire at most once per order.
--     The dispatcher's enrichFromDb will fill plan_name/monthly_amount from order_items.
CREATE OR REPLACE FUNCTION public.trg_doc_welcome_letter_on_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_account_id uuid;
  v_email      text;
  v_payload    jsonb;
BEGIN
  SELECT id INTO v_account_id
  FROM public.accounts
  WHERE client_id = NEW.user_id
  ORDER BY created_at DESC LIMIT 1;

  SELECT email INTO v_email FROM public.profiles WHERE user_id = NEW.user_id;

  v_payload := public._build_doc_client_payload(NEW.user_id, v_account_id)
    || jsonb_build_object(
        'letter_number', 'BVN-' || to_char(now(), 'YYYYMMDD') || '-' || SUBSTRING(NEW.id::text, 1, 8),
        'created_at',    NEW.created_at,
        'order_id',      NEW.id
    );

  PERFORM public.enqueue_document_job(
    v_account_id, NEW.user_id, 'welcome_letter', 'order.activated',
    'welcome_letter::order::' || NEW.id::text,
    COALESCE(v_email, NEW.client_email), v_payload
  );
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS doc_welcome_letter_on_order ON public.orders;
CREATE TRIGGER doc_welcome_letter_on_order
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (NEW.status IN ('activated', 'completed', 'delivered')
        AND (OLD.status IS DISTINCT FROM NEW.status)
        AND NEW.user_id IS NOT NULL)
  EXECUTE FUNCTION public.trg_doc_welcome_letter_on_order();

-- ============================================================================
-- 2) ADDRESS CHANGE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_doc_address_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text; v_payload jsonb; v_changed text;
BEGIN
  IF (NEW.billing_address IS DISTINCT FROM OLD.billing_address
      OR NEW.billing_city IS DISTINCT FROM OLD.billing_city
      OR NEW.billing_postal_code IS DISTINCT FROM OLD.billing_postal_code) THEN
    v_changed := 'billing';
  ELSIF (NEW.primary_service_address IS DISTINCT FROM OLD.primary_service_address
      OR NEW.primary_service_city IS DISTINCT FROM OLD.primary_service_city
      OR NEW.primary_service_postal_code IS DISTINCT FROM OLD.primary_service_postal_code) THEN
    v_changed := 'service';
  ELSE RETURN NEW; END IF;

  SELECT email INTO v_email FROM public.profiles WHERE user_id = NEW.client_id;
  v_payload := public._build_doc_client_payload(NEW.client_id, NEW.id)
    || jsonb_build_object(
      'notice_number', 'ADR-' || to_char(now(),'YYYYMMDDHH24MISS') || '-' || SUBSTRING(NEW.id::text,1,4),
      'change_type', v_changed,
      'old_address', CASE WHEN v_changed='billing'
        THEN jsonb_build_object('street',OLD.billing_address,'city',OLD.billing_city,'province',OLD.billing_province,'postal_code',OLD.billing_postal_code)
        ELSE jsonb_build_object('street',OLD.primary_service_address,'city',OLD.primary_service_city,'province',OLD.primary_service_province,'postal_code',OLD.primary_service_postal_code) END,
      'new_address', CASE WHEN v_changed='billing'
        THEN jsonb_build_object('street',NEW.billing_address,'city',NEW.billing_city,'province',NEW.billing_province,'postal_code',NEW.billing_postal_code)
        ELSE jsonb_build_object('street',NEW.primary_service_address,'city',NEW.primary_service_city,'province',NEW.primary_service_province,'postal_code',NEW.primary_service_postal_code) END,
      'effective_date', now());
  PERFORM public.enqueue_document_job(NEW.id, NEW.client_id, 'address_change', 'account.address_changed',
    'address_change::' || NEW.id::text || '::' || extract(epoch from now())::bigint, v_email, v_payload);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS doc_address_change_on_account ON public.accounts;
CREATE TRIGGER doc_address_change_on_account
  AFTER UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.trg_doc_address_change();

-- ============================================================================
-- 3) PAYMENT METHOD CHANGE
--    billing_customers does not have default_payment_method_id / autopay_enabled.
--    Trigger is kept as a placeholder but exits early (no-op).
--    PDF can still be generated on-demand via dispatcher.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_doc_payment_method_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS doc_payment_method_change_on_billing_customer ON public.billing_customers;
CREATE TRIGGER doc_payment_method_change_on_billing_customer
  AFTER UPDATE ON public.billing_customers
  FOR EACH ROW EXECUTE FUNCTION public.trg_doc_payment_method_change();

-- ============================================================================
-- 5) SUSPENSION NOTICE — accounts.UPDATE (keeps existing path for manual suspensions)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_doc_suspension_notice()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text; v_payload jsonb;
BEGIN
  IF NEW.status <> 'suspended' OR OLD.status = 'suspended' THEN RETURN NEW; END IF;
  SELECT email INTO v_email FROM public.profiles WHERE user_id = NEW.client_id;
  v_payload := public._build_doc_client_payload(NEW.client_id, NEW.id)
    || jsonb_build_object(
      'notice_number', 'SUS-' || to_char(now(),'YYYYMMDDHH24MISS'),
      'suspension_date', now(),
      'reason', 'Solde impayé');
  PERFORM public.enqueue_document_job(NEW.id, NEW.client_id, 'suspension_notice', 'account.suspended',
    'suspension_notice::acct::' || NEW.id::text || '::' || extract(epoch from now())::bigint, v_email, v_payload);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS doc_suspension_notice_on_account ON public.accounts;
CREATE TRIGGER doc_suspension_notice_on_account
  AFTER UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.trg_doc_suspension_notice();

-- 5b) SUSPENSION NOTICE — billing_subscriptions.UPDATE (billing-lifecycle path at J+5)
--     billing-lifecycle suspends billing_subscriptions but NOT accounts, so the
--     account-level trigger never fires. This covers that gap.
CREATE OR REPLACE FUNCTION public.trg_doc_suspension_notice_on_sub()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id    uuid;
  v_account_id uuid;
  v_email      text;
  v_payload    jsonb;
BEGIN
  IF NEW.status <> 'suspended' OR OLD.status = 'suspended' THEN RETURN NEW; END IF;

  SELECT user_id INTO v_user_id FROM public.billing_customers WHERE id = NEW.customer_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_account_id FROM public.accounts WHERE client_id = v_user_id ORDER BY created_at DESC LIMIT 1;
  SELECT email INTO v_email FROM public.profiles WHERE user_id = v_user_id;

  v_payload := public._build_doc_client_payload(v_user_id, v_account_id)
    || jsonb_build_object(
      'notice_number',    'SUS-' || to_char(now(), 'YYYYMMDDHH24MISS'),
      'suspension_date',  now(),
      'reason',           'Solde impayé',
      'service_name',     COALESCE(NEW.plan_name, 'Service Nivra Telecom')
    );

  PERFORM public.enqueue_document_job(
    v_account_id, v_user_id, 'suspension_notice', 'subscription.suspended',
    'suspension_notice::sub::' || NEW.id::text || '::' || extract(epoch from now())::bigint,
    v_email, v_payload
  );
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS doc_suspension_notice_on_sub ON public.billing_subscriptions;
CREATE TRIGGER doc_suspension_notice_on_sub
  AFTER UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.trg_doc_suspension_notice_on_sub();

-- ============================================================================
-- NEW) REACTIVATION NOTICE — billing_subscriptions.UPDATE (status suspended→active)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_doc_reactivation_notice()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id    uuid;
  v_account_id uuid;
  v_email      text;
  v_payload    jsonb;
BEGIN
  IF NEW.status <> 'active' OR OLD.status IS DISTINCT FROM 'suspended' THEN RETURN NEW; END IF;

  SELECT user_id INTO v_user_id FROM public.billing_customers WHERE id = NEW.customer_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_account_id FROM public.accounts WHERE client_id = v_user_id ORDER BY created_at DESC LIMIT 1;
  SELECT email INTO v_email FROM public.profiles WHERE user_id = v_user_id;

  v_payload := public._build_doc_client_payload(v_user_id, v_account_id)
    || jsonb_build_object(
      'notice_number',      'REA-' || to_char(now(), 'YYYYMMDDHH24MISS'),
      'reactivation_date',  now(),
      'service_name',       COALESCE(NEW.plan_name, 'Service Nivra Telecom'),
      'monthly_amount',     COALESCE(NEW.plan_price, 0),
      'next_billing_date',  NEW.next_renewal_at
    );

  PERFORM public.enqueue_document_job(
    v_account_id, v_user_id, 'reactivation_notice', 'subscription.reactivated',
    'reactivation_notice::sub::' || NEW.id::text || '::' || extract(epoch from now())::bigint,
    v_email, v_payload
  );
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS doc_reactivation_notice_on_sub ON public.billing_subscriptions;
CREATE TRIGGER doc_reactivation_notice_on_sub
  AFTER UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.trg_doc_reactivation_notice();

-- ============================================================================
-- 6) CANCELLATION CONFIRMATION — accounts.UPDATE (cancelled_at set)
--    billing-lifecycle J+10 sets accounts.cancelled_at so this fires correctly.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_doc_cancellation_confirmation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text; v_payload jsonb;
BEGIN
  IF NEW.cancelled_at IS NOT DISTINCT FROM OLD.cancelled_at THEN RETURN NEW; END IF;
  IF NEW.cancelled_at IS NULL THEN RETURN NEW; END IF;
  SELECT email INTO v_email FROM public.profiles WHERE user_id = NEW.client_id;
  v_payload := public._build_doc_client_payload(NEW.client_id, NEW.id)
    || jsonb_build_object(
      'confirmation_number', 'CAN-' || to_char(NEW.cancelled_at,'YYYYMMDDHH24MISS'),
      'cancellation_date', NEW.cancelled_at);
  PERFORM public.enqueue_document_job(NEW.id, NEW.client_id, 'cancellation_confirmation', 'account.cancelled',
    'cancellation_confirmation::' || NEW.id::text, v_email, v_payload);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS doc_cancellation_on_account ON public.accounts;
CREATE TRIGGER doc_cancellation_on_account
  AFTER UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.trg_doc_cancellation_confirmation();

-- ============================================================================
-- 7) CHARGEBACK NOTICE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_doc_chargeback_notice()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text; v_payload jsonb;
BEGIN
  IF NEW.has_active_chargeback IS NOT TRUE OR OLD.has_active_chargeback IS TRUE THEN RETURN NEW; END IF;
  SELECT email INTO v_email FROM public.profiles WHERE user_id = NEW.client_id;
  v_payload := public._build_doc_client_payload(NEW.client_id, NEW.id)
    || jsonb_build_object(
      'notice_number', 'CHB-' || to_char(now(),'YYYYMMDDHH24MISS'),
      'chargeback_opened_at', NEW.chargeback_opened_at);
  PERFORM public.enqueue_document_job(NEW.id, NEW.client_id, 'chargeback_notice', 'account.chargeback_opened',
    'chargeback_notice::' || NEW.id::text || '::' || COALESCE(extract(epoch from NEW.chargeback_opened_at)::bigint, extract(epoch from now())::bigint),
    v_email, v_payload);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS doc_chargeback_on_account ON public.accounts;
CREATE TRIGGER doc_chargeback_on_account
  AFTER UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.trg_doc_chargeback_notice();

-- ============================================================================
-- 8) FINAL REFUND RECEIPT
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_doc_final_refund_receipt()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_client_id uuid; v_email text; v_account_id uuid; v_payload jsonb;
BEGIN
  IF NEW.amount >= 0 THEN RETURN NEW; END IF;
  SELECT user_id, email INTO v_client_id, v_email FROM public.billing_customers WHERE id = NEW.customer_id;
  IF v_client_id IS NULL THEN RETURN NEW; END IF;
  SELECT id INTO v_account_id FROM public.accounts WHERE client_id = v_client_id LIMIT 1;
  v_payload := public._build_doc_client_payload(v_client_id, v_account_id)
    || jsonb_build_object(
      'receipt_number', COALESCE(NEW.payment_number, 'REF-' || to_char(now(),'YYYYMMDDHH24MISS')),
      'refund_amount', ABS(NEW.amount),
      'refund_date', COALESCE(NEW.received_at, NEW.created_at),
      'method', NEW.method,
      'reference', NEW.reference);
  PERFORM public.enqueue_document_job(v_account_id, v_client_id, 'final_refund_receipt', 'payment.refunded',
    'final_refund_receipt::' || NEW.id::text, v_email, v_payload);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS doc_final_refund_on_payment ON public.billing_payments;
CREATE TRIGGER doc_final_refund_on_payment
  AFTER INSERT ON public.billing_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_doc_final_refund_receipt();

-- ============================================================================
-- 9) DELIVERY SLIP
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_doc_delivery_slip()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_payload jsonb;
BEGIN
  IF NEW.status IS DISTINCT FROM 'shipped' OR OLD.status = 'shipped' THEN RETURN NEW; END IF;
  v_payload := public._build_doc_client_payload(NEW.user_id, NEW.account_id)
    || jsonb_build_object(
      'slip_number', 'BL-' || COALESCE(NEW.order_number, SUBSTRING(NEW.id::text,1,8)),
      'order_number', NEW.order_number,
      'tracking_number', NEW.tracking_number,
      'carrier', NEW.carrier,
      'shipped_at', COALESCE(NEW.shipped_at, now()),
      'equipment_details', NEW.equipment_details);
  PERFORM public.enqueue_document_job(NEW.account_id, NEW.user_id, 'delivery_slip', 'order.shipped',
    'delivery_slip::' || NEW.id::text,
    COALESCE(NEW.client_email, (SELECT email FROM public.profiles WHERE user_id = NEW.user_id)),
    v_payload);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS doc_delivery_slip_on_order ON public.orders;
CREATE TRIGGER doc_delivery_slip_on_order
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_doc_delivery_slip();

-- ============================================================================
-- 10) RETURN INSTRUCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_doc_return_instructions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_payload jsonb;
BEGIN
  IF NEW.status NOT IN ('return_initiated','return_requested') THEN RETURN NEW; END IF;
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  v_payload := public._build_doc_client_payload(NEW.user_id, NEW.account_id)
    || jsonb_build_object(
      'instruction_number', 'RET-' || COALESCE(NEW.order_number, SUBSTRING(NEW.id::text,1,8)),
      'order_number', NEW.order_number,
      'equipment_details', NEW.equipment_details,
      'requested_at', now());
  PERFORM public.enqueue_document_job(NEW.account_id, NEW.user_id, 'return_instructions', 'order.return_initiated',
    'return_instructions::' || NEW.id::text,
    COALESCE(NEW.client_email, (SELECT email FROM public.profiles WHERE user_id = NEW.user_id)),
    v_payload);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS doc_return_instructions_on_order ON public.orders;
CREATE TRIGGER doc_return_instructions_on_order
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_doc_return_instructions();

-- ============================================================================
-- 11) INSTALLATION REPORT
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_doc_installation_report()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text; v_account_id uuid; v_payload jsonb;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.service_type,'') NOT ILIKE '%install%' THEN RETURN NEW; END IF;
  IF NEW.client_id IS NULL THEN RETURN NEW; END IF;
  SELECT email INTO v_email FROM public.profiles WHERE user_id = NEW.client_id;
  SELECT id INTO v_account_id FROM public.accounts WHERE client_id = NEW.client_id LIMIT 1;
  v_payload := public._build_doc_client_payload(NEW.client_id, v_account_id)
    || jsonb_build_object(
      'report_number', 'INS-' || COALESCE(NEW.appointment_number, SUBSTRING(NEW.id::text,1,8)),
      'appointment_number', NEW.appointment_number,
      'completed_at', now(),
      'technician_id', NEW.technician_id,
      'service_type', NEW.service_type,
      'service_address', jsonb_build_object('street',NEW.service_address,'city',NEW.service_city,'postal_code',NEW.service_postal_code),
      'equipment_details', NEW.equipment_details,
      'internal_notes', NEW.internal_notes);
  PERFORM public.enqueue_document_job(v_account_id, NEW.client_id, 'installation_report',
    'appointment.installation_completed', 'installation_report::' || NEW.id::text,
    COALESCE(NEW.client_email, v_email), v_payload);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS doc_installation_report_on_appointment ON public.appointments;
CREATE TRIGGER doc_installation_report_on_appointment
  AFTER UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.trg_doc_installation_report();

-- ============================================================================
-- 12) ACTIVATION CONFIRMATION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_doc_activation_confirmation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text; v_account_id uuid; v_payload jsonb;
BEGIN
  IF NEW.status NOT IN ('activated','completed') OR OLD.status = NEW.status THEN RETURN NEW; END IF;
  SELECT email INTO v_email FROM public.profiles WHERE user_id = NEW.client_id;
  SELECT id INTO v_account_id FROM public.accounts WHERE client_id = NEW.client_id LIMIT 1;
  v_payload := public._build_doc_client_payload(NEW.client_id, v_account_id)
    || jsonb_build_object(
      'confirmation_number', 'ACT-' || SUBSTRING(NEW.id::text,1,8),
      'activated_at', COALESCE(NEW.activated_at, now()),
      'wifi_network_name', NEW.wifi_network_name,
      'order_id', NEW.order_id);
  PERFORM public.enqueue_document_job(v_account_id, NEW.client_id, 'activation_confirmation', 'activation.completed',
    'activation_confirmation::' || NEW.id::text, v_email, v_payload);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS doc_activation_confirmation_on_request ON public.activation_requests;
CREATE TRIGGER doc_activation_confirmation_on_request
  AFTER UPDATE ON public.activation_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_doc_activation_confirmation();

-- ============================================================================
-- 13) CONTRACT AMENDMENT — latest version from 20260615220001
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_doc_contract_amendment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client_id   uuid;
  v_email       text;
  v_account_id  uuid;
  v_change_type text;
  v_payload     jsonb;
  v_plan_price  numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN v_change_type := 'service_added';
  ELSIF TG_OP = 'UPDATE' AND OLD.is_active = TRUE AND NEW.is_active = FALSE THEN v_change_type := 'service_removed';
  ELSE RETURN NEW; END IF;

  SELECT bc.user_id, bc.email INTO v_client_id, v_email
  FROM public.billing_subscriptions bs
  JOIN public.billing_customers bc ON bc.id = bs.customer_id
  WHERE bs.id = NEW.subscription_id;
  IF v_client_id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_account_id FROM public.accounts WHERE client_id = v_client_id LIMIT 1;

  v_plan_price := NEW.unit_price;
  IF v_plan_price IS NULL OR v_plan_price = 0 THEN
    SELECT plan_price INTO v_plan_price FROM public.billing_subscriptions WHERE id = NEW.subscription_id;
  END IF;

  v_payload := public._build_doc_client_payload(v_client_id, v_account_id)
    || jsonb_build_object(
        'amendment_number', 'AMD-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || SUBSTRING(NEW.id::text, 1, 4),
        'change_type',      v_change_type,
        'service_name',     NEW.service_name,
        'service_code',     NEW.service_code,
        'unit_price',       COALESCE(v_plan_price, 0),
        'plan_price',       COALESCE(v_plan_price, 0),
        'quantity',         NEW.quantity,
        'effective_date',   COALESCE(NEW.removed_at, NEW.added_at, now())
    );

  PERFORM public.enqueue_document_job(
    v_account_id, v_client_id, 'contract_amendment', 'subscription.' || v_change_type,
    'contract_amendment::' || NEW.id::text || '::' || v_change_type, v_email, v_payload
  );
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS doc_contract_amendment_on_service ON public.billing_subscription_services;
CREATE TRIGGER doc_contract_amendment_on_service
  AFTER INSERT OR UPDATE ON public.billing_subscription_services
  FOR EACH ROW EXECUTE FUNCTION public.trg_doc_contract_amendment();

-- ============================================================================
-- 14) FORMAL DEMAND
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_doc_formal_demand()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text; v_payload jsonb;
BEGIN
  IF NEW.recouvrement_reminder_sent_at IS NOT DISTINCT FROM OLD.recouvrement_reminder_sent_at THEN RETURN NEW; END IF;
  IF NEW.recouvrement_reminder_sent_at IS NULL THEN RETURN NEW; END IF;
  SELECT email INTO v_email FROM public.profiles WHERE user_id = NEW.client_id;
  v_payload := public._build_doc_client_payload(NEW.client_id, NEW.id)
    || jsonb_build_object(
      'demand_number', 'MED-' || to_char(NEW.recouvrement_reminder_sent_at,'YYYYMMDDHH24MISS'),
      'demand_date', NEW.recouvrement_reminder_sent_at);
  PERFORM public.enqueue_document_job(NEW.id, NEW.client_id, 'formal_demand', 'account.formal_demand_sent',
    'formal_demand::' || NEW.id::text || '::' || extract(epoch from NEW.recouvrement_reminder_sent_at)::bigint,
    v_email, v_payload);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS doc_formal_demand_on_account ON public.accounts;
CREATE TRIGGER doc_formal_demand_on_account
  AFTER UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.trg_doc_formal_demand();

-- ============================================================================
-- 15) COLLECTIONS TRANSFER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_doc_collections_transfer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text; v_payload jsonb;
BEGIN
  IF NEW.status <> 'collections' OR OLD.status = 'collections' THEN RETURN NEW; END IF;
  SELECT email INTO v_email FROM public.profiles WHERE user_id = NEW.client_id;
  v_payload := public._build_doc_client_payload(NEW.client_id, NEW.id)
    || jsonb_build_object(
      'transfer_number', 'COL-' || to_char(now(),'YYYYMMDDHH24MISS'),
      'transfer_date', now());
  PERFORM public.enqueue_document_job(NEW.id, NEW.client_id, 'collections_transfer', 'account.collections_transferred',
    'collections_transfer::' || NEW.id::text, v_email, v_payload);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS doc_collections_on_account ON public.accounts;
CREATE TRIGGER doc_collections_on_account
  AFTER UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.trg_doc_collections_transfer();

-- ============================================================================
-- 16) COMPLAINT ACKNOWLEDGMENT
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_doc_complaint_acknowledgment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text; v_account_id uuid; v_payload jsonb;
BEGIN
  IF COALESCE(NEW.category,'') NOT IN ('complaint','plainte') THEN RETURN NEW; END IF;
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  SELECT email INTO v_email FROM public.profiles WHERE user_id = NEW.user_id;
  SELECT id INTO v_account_id FROM public.accounts WHERE client_id = NEW.user_id LIMIT 1;
  v_payload := public._build_doc_client_payload(NEW.user_id, v_account_id)
    || jsonb_build_object(
      'acknowledgment_number', 'PLT-' || COALESCE(NEW.ticket_number, SUBSTRING(NEW.id::text,1,8)),
      'ticket_number', NEW.ticket_number,
      'ticket_id', NEW.id,
      'subject', NEW.subject,
      'received_at', NEW.created_at);
  PERFORM public.enqueue_document_job(v_account_id, NEW.user_id, 'complaint_acknowledgment',
    'ticket.complaint_received', 'complaint_acknowledgment::' || NEW.id::text,
    COALESCE(NEW.client_email, v_email), v_payload);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS doc_complaint_ack_on_ticket ON public.support_tickets;
CREATE TRIGGER doc_complaint_ack_on_ticket
  AFTER INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.trg_doc_complaint_acknowledgment();

-- ============================================================================
-- 17) PREAUTHORIZATION CONFIRMATION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_doc_preauth_confirmation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_client_id uuid; v_email text; v_account_id uuid; v_payload jsonb;
BEGIN
  IF NEW.authorization_status <> 'authorized' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.authorization_status = 'authorized' THEN RETURN NEW; END IF;
  SELECT user_id, email INTO v_client_id, v_email FROM public.billing_customers WHERE id = NEW.customer_id;
  IF v_client_id IS NULL THEN RETURN NEW; END IF;
  SELECT id INTO v_account_id FROM public.accounts WHERE client_id = v_client_id LIMIT 1;
  v_payload := public._build_doc_client_payload(v_client_id, v_account_id)
    || jsonb_build_object(
      'confirmation_number', COALESCE(NEW.payment_number, 'PRE-' || to_char(now(),'YYYYMMDDHH24MISS')),
      'authorized_amount', NEW.authorized_amount,
      'authorized_at', NEW.authorized_at,
      'method', NEW.method);
  PERFORM public.enqueue_document_job(v_account_id, v_client_id, 'preauthorization_confirmation', 'payment.authorized',
    'preauth_confirmation::' || NEW.id::text, v_email, v_payload);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS doc_preauth_on_payment ON public.billing_payments;
CREATE TRIGGER doc_preauth_on_payment
  AFTER INSERT OR UPDATE OF authorization_status ON public.billing_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_doc_preauth_confirmation();

-- ============================================================================
-- NEW) CREDIT NOTE — account_adjustments.INSERT
--      Fires when admin adds a credit/first_month_free/one_time adjustment.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_doc_credit_note()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client_id  uuid;
  v_email      text;
  v_payload    jsonb;
BEGIN
  IF NEW.type NOT IN ('credit', 'first_month_free', 'one_time') THEN RETURN NEW; END IF;
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;

  SELECT client_id INTO v_client_id FROM public.accounts WHERE id = NEW.account_id;
  IF v_client_id IS NULL THEN RETURN NEW; END IF;

  SELECT email INTO v_email FROM public.profiles WHERE user_id = v_client_id;

  v_payload := public._build_doc_client_payload(v_client_id, NEW.account_id)
    || jsonb_build_object(
      'credit_number',  'CRE-' || to_char(NEW.created_at, 'YYYYMMDDHH24MISS') || '-' || SUBSTRING(NEW.id::text, 1, 6),
      'description',    NEW.description,
      'amount',         NEW.amount,
      'credit_type',    NEW.type,
      'months_total',   NEW.months_total,
      'is_permanent',   NEW.is_permanent
    );

  PERFORM public.enqueue_document_job(
    NEW.account_id, v_client_id, 'credit_note', 'account.credit_added',
    'credit_note::' || NEW.id::text,
    v_email, v_payload
  );
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS doc_credit_note_on_adjustment ON public.account_adjustments;
CREATE TRIGGER doc_credit_note_on_adjustment
  AFTER INSERT ON public.account_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.trg_doc_credit_note();
