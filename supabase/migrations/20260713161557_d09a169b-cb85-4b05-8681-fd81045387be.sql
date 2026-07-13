
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='order_cancellation_reason_code') THEN
    CREATE TYPE public.order_cancellation_reason_code AS ENUM (
      'client_changed_mind','payment_issue','address_not_serviceable',
      'agent_error','fraud','duplicate','other');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id uuid, actor_email text, actor_role text, source text,
  previous_status text, new_status text,
  reason_code text, reason_note text,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON public.order_events(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_events_event_type ON public.order_events(event_type);

GRANT SELECT ON public.order_events TO authenticated;
GRANT ALL ON public.order_events TO service_role;

ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read order events" ON public.order_events;
CREATE POLICY "staff read order events" ON public.order_events
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'support'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
  OR public.has_role(auth.uid(), 'sales'::app_role)
  OR public.has_role(auth.uid(), 'billing_admin'::app_role)
  OR public.has_role(auth.uid(), 'supervisor'::app_role)
  OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_events.order_id AND o.user_id = auth.uid())
);

DROP POLICY IF EXISTS "service role write order events" ON public.order_events;
CREATE POLICY "service role write order events" ON public.order_events
FOR INSERT TO service_role WITH CHECK (true);

CREATE OR REPLACE FUNCTION public._trg_orders_status_change_to_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_events(order_id, event_type, previous_status, new_status, payload)
    VALUES (NEW.id, 'status_changed', OLD.status::text, NEW.status::text,
            jsonb_build_object('order_number', NEW.order_number, 'auto', true));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_orders_status_change_to_events ON public.orders;
CREATE TRIGGER trg_orders_status_change_to_events
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public._trg_orders_status_change_to_events();

CREATE OR REPLACE FUNCTION public.cancel_order_preview_v1(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_order RECORD; v_case text; v_actions jsonb := '[]'::jsonb;
  v_invoices_paid numeric := 0; v_appts int := 0; v_techs int := 0;
  v_subs int := 0; v_prov int := 0; v_intents int := 0; v_open_invoice_count int := 0;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND'); END IF;
  IF lower(v_order.status::text) IN ('cancelled','canceled','service_cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_CANCELLED', 'status', v_order.status);
  END IF;

  SELECT COALESCE(SUM(bp.amount),0) INTO v_invoices_paid
    FROM public.billing_payments bp JOIN public.billing_invoices bi ON bi.id = bp.invoice_id
   WHERE bi.order_id = p_order_id AND bp.status = 'confirmed';

  SELECT COUNT(*) INTO v_open_invoice_count FROM public.billing_invoices
   WHERE order_id = p_order_id AND lower(status::text) NOT IN ('paid','cancelled','voided','refunded');

  SELECT COUNT(*) INTO v_appts FROM public.appointments
   WHERE order_id = p_order_id AND lower(coalesce(status,'')) NOT IN ('cancelled','completed');

  SELECT COUNT(*) INTO v_techs FROM public.technician_assignments
   WHERE order_id = p_order_id AND lower(coalesce(status,'')) NOT IN ('cancelled','completed');

  SELECT COUNT(*) INTO v_subs FROM public.billing_subscriptions
   WHERE order_id = p_order_id AND status IN ('active','pending');

  SELECT COUNT(*) INTO v_prov FROM public.provisioning_jobs
   WHERE order_id = p_order_id AND lower(status::text) NOT IN ('completed','cancelled','failed');

  SELECT COUNT(*) INTO v_intents FROM public.field_payment_intents
   WHERE (metadata->>'order_id') = p_order_id::text
     AND lower(coalesce(status,'')) NOT IN ('captured','cancelled','failed');

  IF v_invoices_paid = 0 THEN v_case := 'case_1_before_payment';
  ELSIF v_order.status::text IN ('activated','active') THEN v_case := 'case_4_active_service';
  ELSIF v_techs > 0 OR v_appts > 0 THEN v_case := 'case_3_installation_scheduled';
  ELSE v_case := 'case_2_paid_not_activated'; END IF;

  IF v_open_invoice_count > 0 THEN v_actions := v_actions || jsonb_build_object('action','cancel_invoices','count',v_open_invoice_count,'label','Annuler les factures ouvertes'); END IF;
  IF v_intents > 0 THEN v_actions := v_actions || jsonb_build_object('action','cancel_payment_intents','count',v_intents,'label','Annuler les intentions de paiement'); END IF;
  IF v_appts > 0 THEN v_actions := v_actions || jsonb_build_object('action','cancel_appointments','count',v_appts,'label','Annuler le(s) rendez-vous'); END IF;
  IF v_techs > 0 THEN v_actions := v_actions || jsonb_build_object('action','release_technicians','count',v_techs,'label','Libérer les techniciens assignés'); END IF;
  IF v_subs > 0 THEN v_actions := v_actions || jsonb_build_object('action','cancel_subscriptions','count',v_subs,'label','Annuler les abonnements'); END IF;
  IF v_prov > 0 THEN v_actions := v_actions || jsonb_build_object('action','cancel_provisioning','count',v_prov,'label','Annuler le provisioning en cours'); END IF;
  IF v_invoices_paid > 0 AND v_case <> 'case_4_active_service' THEN v_actions := v_actions || jsonb_build_object('action','refund','amount',v_invoices_paid,'label','Remboursement à traiter'); END IF;
  IF v_case = 'case_4_active_service' THEN v_actions := v_actions || jsonb_build_object('action','final_billing','label','Facturation finale + terminaison service'); END IF;
  v_actions := v_actions || jsonb_build_object('action','notify_client','label','Notifier le client par courriel');
  v_actions := v_actions || jsonb_build_object('action','audit_log','label','Journaliser dans le registre d''audit');

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id, 'order_number', v_order.order_number,
    'current_status', v_order.status, 'case', v_case,
    'has_confirmed_payment', v_invoices_paid > 0, 'confirmed_payment_total', v_invoices_paid,
    'cascade', v_actions);
END $$;

GRANT EXECUTE ON FUNCTION public.cancel_order_preview_v1(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cancel_order_v1(
  p_order_id uuid, p_reason_code text, p_reason_note text,
  p_actor_id uuid, p_actor_email text, p_actor_role text, p_source text,
  p_idempotency_key text DEFAULT NULL, p_dry_run boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_order RECORD; v_preview jsonb; v_case text; v_previous_status text;
  v_report jsonb := '{}'::jsonb; v_refund_required boolean := false;
  v_refund_amount numeric := 0; v_count int; v_final_status text;
BEGIN
  IF p_reason_code IS NULL OR p_reason_code NOT IN
    ('client_changed_mind','payment_issue','address_not_serviceable','agent_error','fraud','duplicate','other') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REASON_CODE'); END IF;
  IF p_reason_note IS NULL OR length(trim(p_reason_note)) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'REASON_NOTE_TOO_SHORT'); END IF;

  v_preview := public.cancel_order_preview_v1(p_order_id);
  IF (v_preview->>'ok')::boolean IS DISTINCT FROM true THEN RETURN v_preview; END IF;
  IF p_dry_run THEN RETURN v_preview || jsonb_build_object('dry_run', true); END IF;

  IF p_idempotency_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.order_events
     WHERE order_id = p_order_id AND event_type='order_cancelled'
       AND payload->>'idempotency_key' = p_idempotency_key
  ) THEN RETURN jsonb_build_object('ok', true, 'idempotent', true, 'order_id', p_order_id); END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND'); END IF;
  v_previous_status := v_order.status::text;
  v_case := v_preview->>'case';
  v_refund_amount := COALESCE((v_preview->>'confirmed_payment_total')::numeric, 0);
  v_refund_required := v_refund_amount > 0 AND v_case <> 'case_4_active_service';

  UPDATE public.quotes SET status = 'cancelled', updated_at = now()
   WHERE order_id = p_order_id AND status::text NOT IN ('cancelled','rejected','expired');
  GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('quotes_cancelled', v_count);

  UPDATE public.field_quotes SET status = 'cancelled', updated_at = now()
   WHERE (metadata->>'order_id') = p_order_id::text AND lower(coalesce(status,'')) NOT IN ('cancelled','rejected','expired');
  GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('field_quotes_cancelled', v_count);

  UPDATE public.field_payment_intents SET status = 'cancelled', updated_at = now()
   WHERE (metadata->>'order_id') = p_order_id::text
     AND lower(coalesce(status,'')) NOT IN ('captured','cancelled','failed');
  GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('payment_intents_cancelled', v_count);

  UPDATE public.appointments
     SET status = 'cancelled', cancellation_reason = p_reason_note, updated_at = now()
   WHERE order_id = p_order_id AND lower(coalesce(status,'')) NOT IN ('cancelled','completed');
  GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('appointments_cancelled', v_count);

  UPDATE public.technician_slot_bookings SET status = 'cancelled', updated_at = now()
   WHERE order_id = p_order_id AND lower(coalesce(status,'')) NOT IN ('cancelled','completed');
  GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('slot_bookings_released', v_count);

  UPDATE public.technician_assignments SET status = 'cancelled', updated_at = now()
   WHERE order_id = p_order_id AND lower(coalesce(status,'')) NOT IN ('cancelled','completed');
  GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('tech_assignments_released', v_count);

  UPDATE public.provisioning_jobs SET status = 'cancelled', updated_at = now()
   WHERE order_id = p_order_id AND lower(status::text) NOT IN ('completed','cancelled','failed');
  GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('provisioning_jobs_cancelled', v_count);

  UPDATE public.activation_requests SET status = 'cancelled', updated_at = now()
   WHERE order_id = p_order_id AND lower(coalesce(status,'')) NOT IN ('completed','cancelled','failed');
  GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('activation_requests_cancelled', v_count);

  UPDATE public.contracts SET status = 'cancelled', updated_at = now()
   WHERE order_id = p_order_id AND lower(coalesce(status,'')) NOT IN ('cancelled','terminated');
  GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('contracts_cancelled', v_count);

  IF v_case = 'case_4_active_service' THEN
    UPDATE public.billing_subscriptions
       SET status = 'cancelled', end_date = COALESCE(end_date, now()::date), updated_at = now()
     WHERE order_id = p_order_id AND status IN ('active','pending');
    GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('subscriptions_terminated', v_count);

    UPDATE public.service_instances
       SET status = 'terminated', end_date = COALESCE(end_date, now()::date), updated_at = now()
     WHERE order_id = p_order_id AND lower(coalesce(status,'')) NOT IN ('terminated','cancelled');
    GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('service_instances_terminated', v_count);
  ELSE
    UPDATE public.billing_subscriptions SET status = 'cancelled', updated_at = now()
     WHERE order_id = p_order_id AND status IN ('active','pending');
    GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('subscriptions_cancelled', v_count);
  END IF;

  UPDATE public.billing_invoices
     SET status = 'cancelled', balance_due = 0, updated_at = now(),
         notes = COALESCE(notes,'') || E'\n[cancel_order_v1] '||p_reason_code||' — '||coalesce(p_reason_note,'')
   WHERE order_id = p_order_id AND COALESCE(amount_paid, 0) = 0
     AND lower(status::text) NOT IN ('paid','refunded','credited','cancelled','voided','void');
  GET DIAGNOSTICS v_count = ROW_COUNT; v_report := v_report || jsonb_build_object('invoices_voided', v_count);

  v_final_status := CASE WHEN v_case = 'case_4_active_service' THEN 'service_cancelled' ELSE 'cancelled' END;

  BEGIN
    UPDATE public.orders SET status = v_final_status, cancellation_reason = p_reason_note,
             cancelled_at = now(), updated_at = now() WHERE id = p_order_id;
    v_report := v_report || jsonb_build_object('order_final_status', v_final_status);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%confirmed payment%' AND v_refund_required THEN
      UPDATE public.orders SET cancellation_reason = p_reason_note,
               cancelled_at = now(), updated_at = now() WHERE id = p_order_id;
      v_report := v_report || jsonb_build_object(
        'order_final_status', v_previous_status,
        'order_status_change_blocked', true,
        'blocked_reason', 'confirmed_payment_requires_refund_first');
    ELSE RAISE; END IF;
  END;

  INSERT INTO public.order_events(order_id, event_type, actor_id, actor_email, actor_role, source,
    previous_status, new_status, reason_code, reason_note, payload)
  VALUES (p_order_id, 'order_cancelled', p_actor_id, p_actor_email, p_actor_role, p_source,
    v_previous_status, COALESCE(v_report->>'order_final_status', v_previous_status),
    p_reason_code, p_reason_note,
    v_report || jsonb_build_object('idempotency_key', p_idempotency_key,
      'refund_required', v_refund_required, 'refund_amount', v_refund_amount, 'case', v_case));

  BEGIN
    INSERT INTO public.admin_audit_log(admin_id, action, target_table, target_id, details, severity)
    VALUES (p_actor_id, 'order_cancelled', 'orders', p_order_id,
            jsonb_build_object('reason_code',p_reason_code,'reason_note',p_reason_note,
              'source',p_source,'case',v_case,'report',v_report,'previous_status',v_previous_status),
            'warning');
  EXCEPTION WHEN OTHERS THEN NULL; END;

  IF v_order.user_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.client_activity_logs(client_id, actor_user_id, actor_role, action_type,
        entity_type, entity_id, summary, metadata)
      VALUES (v_order.user_id, p_actor_id, COALESCE(p_actor_role,'system'), 'order_cancelled',
        'order', p_order_id,
        'Commande annulée — '||p_reason_code||' — '||coalesce(p_reason_note,''),
        v_report);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id,
    'previous_status', v_previous_status,
    'final_status', COALESCE(v_report->>'order_final_status', v_previous_status),
    'case', v_case, 'refund_required', v_refund_required,
    'refund_amount', v_refund_amount, 'report', v_report);
END $$;

GRANT EXECUTE ON FUNCTION public.cancel_order_v1(uuid, text, text, uuid, text, text, text, text, boolean) TO authenticated, service_role;

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.order_events;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END;
END $$;
