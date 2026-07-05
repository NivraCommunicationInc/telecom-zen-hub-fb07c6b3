
-- 1) Fix enum casts in auto-note triggers
CREATE OR REPLACE FUNCTION public._trg_note_billing_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _client UUID; _body TEXT;
BEGIN
  _client := public._resolve_client_from_billing_customer(NEW.customer_id);
  IF TG_OP = 'INSERT' THEN
    _body := 'Facture générée #' || COALESCE(NEW.invoice_number, substring(NEW.id::text,1,8))
          || ' — ' || public._fmt_money(NEW.total)
          || COALESCE(' — échéance ' || to_char(NEW.due_date, 'YYYY-MM-DD'), '');
    PERFORM public._write_client_auto_note(_client, 'invoice_created', _body, 'invoice', NEW.id);
  ELSIF TG_OP = 'UPDATE'
        AND NEW.status IS DISTINCT FROM OLD.status
        AND lower(NEW.status::text) IN ('overdue','past_due','late') THEN
    _body := 'Facture en retard #' || COALESCE(NEW.invoice_number, substring(NEW.id::text,1,8))
          || ' — ' || public._fmt_money(NEW.balance_due)
          || COALESCE(' — depuis ' || to_char(NEW.due_date, 'YYYY-MM-DD'), '');
    PERFORM public._write_client_auto_note(_client, 'invoice_overdue', _body, 'invoice', NEW.id);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public._trg_note_direct_refund()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _body TEXT;
BEGIN
  IF (TG_OP = 'INSERT' AND lower(coalesce(NEW.status::text,'')) IN ('processed','approved','completed'))
     OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
         AND lower(NEW.status::text) IN ('processed','approved','completed')) THEN
    _body := 'Remboursement émis — ' || public._fmt_money(NEW.amount)
          || COALESCE(' — ' || NEW.refund_method, '')
          || COALESCE(' — Réf ' || NEW.external_reference, '')
          || COALESCE(' — motif : ' || NEW.reason, '');
    PERFORM public._write_client_auto_note(NEW.user_id, 'refund_issued', _body, 'refund', NEW.id);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public._trg_note_equipment_return()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _body TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _body := 'Retour d''équipement demandé' || COALESCE(' — ' || NEW.reason, '');
    PERFORM public._write_client_auto_note(NEW.client_user_id, 'equipment_return_requested', _body, 'return', NEW.id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
        AND lower(NEW.status::text) IN ('completed','received') THEN
    _body := 'Retour d''équipement ' || NEW.status::text
          || COALESCE(' — remboursement ' || public._fmt_money(NEW.refund_amount), '');
    PERFORM public._write_client_auto_note(NEW.client_user_id, 'equipment_returned', _body, 'return', NEW.id);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public._trg_note_installation_job()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _client UUID; _body TEXT; _tech TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND lower(NEW.status::text) IN ('completed','done') THEN
    _client := public._resolve_client_from_account(NEW.account_id);
    SELECT COALESCE(display_name, full_name, email) INTO _tech
      FROM public.profiles WHERE id = NEW.technician_id;
    _body := 'Installation complétée #' || COALESCE(NEW.job_number, substring(NEW.id::text,1,8))
          || COALESCE(' — ' || NEW.service_type, '')
          || COALESCE(' — technicien : ' || _tech, '')
          || COALESCE(' — le ' || to_char(NEW.completed_at, 'YYYY-MM-DD'), '');
    PERFORM public._write_client_auto_note(_client, 'installation_completed', _body, 'installation', NEW.id);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public._trg_note_payment_dispute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _body TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _body := 'Litige de paiement ouvert #' || COALESCE(NEW.dispute_number, substring(NEW.id::text,1,8))
          || COALESCE(' — motif : ' || NEW.reason_code, '');
    PERFORM public._write_client_auto_note(NEW.user_id, 'dispute_opened', _body, 'dispute', NEW.id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
        AND lower(NEW.status::text) IN ('resolved','approved','rejected','closed') THEN
    _body := 'Litige de paiement ' || NEW.status::text || ' #'
          || COALESCE(NEW.dispute_number, substring(NEW.id::text,1,8));
    PERFORM public._write_client_auto_note(NEW.user_id, 'dispute_resolved', _body, 'dispute', NEW.id);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public._trg_note_privacy_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _body TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _body := 'Demande Loi 25 reçue — ' || COALESCE(NEW.request_type, 'demande');
    PERFORM public._write_client_auto_note(NEW.client_id, 'privacy_request_received', _body, 'privacy', NEW.id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
        AND lower(NEW.status::text) IN ('completed','resolved','refused') THEN
    _body := 'Demande Loi 25 ' || NEW.status::text || ' — ' || COALESCE(NEW.request_type,'');
    PERFORM public._write_client_auto_note(NEW.client_id, 'privacy_request_processed', _body, 'privacy', NEW.id);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public._trg_note_service_cancellation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _body TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _body := 'Demande d''annulation de service — ' || COALESCE(NEW.service_type,'service')
          || COALESCE(' — motif : ' || NEW.reason_code, '')
          || COALESCE(' — effective ' || to_char(NEW.requested_effective_date, 'YYYY-MM-DD'), '');
    PERFORM public._write_client_auto_note(NEW.user_id, 'service_cancellation_requested', _body, 'cancellation', NEW.id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
        AND lower(NEW.status::text) IN ('completed','approved','declined','processed') THEN
    _body := 'Demande d''annulation ' || NEW.status::text || ' — ' || COALESCE(NEW.service_type,'');
    PERFORM public._write_client_auto_note(NEW.user_id, 'service_cancellation_processed', _body, 'cancellation', NEW.id);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public._trg_note_shipment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _client UUID; _body TEXT; _event TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    _client := public._resolve_client_from_billing_customer(NEW.customer_id);
    IF lower(NEW.status::text) IN ('shipped','in_transit') THEN
      _event := 'shipment_shipped';
      _body  := 'Équipement expédié' || COALESCE(' — ' || NEW.carrier, '')
             || COALESCE(' — suivi ' || NEW.tracking_number, '');
    ELSIF lower(NEW.status::text) = 'delivered' THEN
      _event := 'shipment_delivered';
      _body  := 'Équipement livré' || COALESCE(' — ' || to_char(NEW.actual_delivery_date, 'YYYY-MM-DD'), '');
    ELSE
      RETURN NEW;
    END IF;
    PERFORM public._write_client_auto_note(_client, _event, _body, 'shipment', NEW.id);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public._trg_note_support_ticket()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _client UUID; _body TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _client := COALESCE(NEW.user_id, NEW.owner_user_id, NEW.created_by_user_id);
    _body := 'Ticket support ouvert #' || COALESCE(NEW.ticket_number, substring(NEW.id::text,1,8))
          || COALESCE(' — ' || NEW.subject, '');
    PERFORM public._write_client_auto_note(_client, 'ticket_created', _body, 'ticket', NEW.id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
        AND lower(NEW.status::text) IN ('resolved','closed') THEN
    _client := COALESCE(NEW.user_id, NEW.owner_user_id, NEW.created_by_user_id);
    _body := 'Ticket support fermé #' || COALESCE(NEW.ticket_number, substring(NEW.id::text,1,8))
          || ' — ' || NEW.status::text;
    PERFORM public._write_client_auto_note(_client, 'ticket_closed', _body, 'ticket', NEW.id);
  END IF;
  RETURN NEW;
END; $$;

-- 2) Cascade: cancelled order → cancel unpaid linked invoices
CREATE OR REPLACE FUNCTION public._trg_cascade_cancel_invoices_on_order_cancel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND lower(NEW.status::text) IN ('cancelled','canceled') THEN
    UPDATE public.billing_invoices
       SET status = 'cancelled',
           balance_due = 0,
           notes = COALESCE(notes, '') ||
                   CASE WHEN COALESCE(notes,'') = '' THEN '' ELSE E'\n' END ||
                   '[Auto] Annulée suite à annulation de la commande '
                   || COALESCE(NEW.order_number, NEW.id::text)
                   || ' le ' || to_char(now(), 'YYYY-MM-DD HH24:MI')
     WHERE order_id = NEW.id
       AND COALESCE(amount_paid, 0) = 0
       AND lower(status::text) NOT IN ('paid','refunded','credited','cancelled','voided','void');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_cascade_cancel_invoices_on_order_cancel ON public.orders;
CREATE TRIGGER trg_cascade_cancel_invoices_on_order_cancel
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public._trg_cascade_cancel_invoices_on_order_cancel();

-- 3) Repair current orphan invoice(s)
UPDATE public.billing_invoices bi
   SET status = 'cancelled',
       balance_due = 0,
       notes = COALESCE(bi.notes,'') ||
               CASE WHEN COALESCE(bi.notes,'') = '' THEN '' ELSE E'\n' END ||
               '[Auto-Repair] Annulée suite à annulation de la commande (rétroactif)'
  FROM public.orders o
 WHERE bi.order_id = o.id
   AND lower(o.status::text) IN ('cancelled','canceled')
   AND COALESCE(bi.amount_paid, 0) = 0
   AND lower(bi.status::text) NOT IN ('paid','refunded','credited','cancelled','voided','void');
