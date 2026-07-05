
-- =====================================================================
-- CHANTIER #17 — Notes automatiques système : couverture complète
-- =====================================================================
-- Installe un helper SQL + triggers DB pour matérialiser une note
-- système dans client_internal_notes (+ mirror activity_logs) à chaque
-- événement métier important. Complète les writes déjà présents dans
-- le code (paiements, RDV, signatures, KYC, orders, plan changes).
-- =====================================================================

CREATE OR REPLACE FUNCTION public._write_client_auto_note(
  _client_id UUID,
  _event TEXT,
  _body TEXT,
  _entity_type TEXT DEFAULT 'client',
  _entity_id UUID DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  SYSTEM_ACTOR CONSTANT UUID := '00000000-0000-0000-0000-000000000000';
  SYSTEM_NAME  CONSTANT TEXT := 'Système Nivra';
BEGIN
  IF _client_id IS NULL OR _body IS NULL OR length(trim(_body)) = 0 THEN
    RETURN;
  END IF;

  -- Dedup guard: same client+event+body written in last 5 seconds ⇒ skip
  IF EXISTS (
    SELECT 1 FROM public.client_internal_notes
    WHERE client_id = _client_id
      AND body = _body
      AND created_at > now() - interval '5 seconds'
  ) THEN
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.client_internal_notes(
      client_id, note_type, body,
      created_by_user_id, created_by_role, created_by_name
    ) VALUES (
      _client_id, 'system', _body,
      SYSTEM_ACTOR, 'system_auto', SYSTEM_NAME
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never break the parent operation
    RAISE WARNING '[auto_note] client_internal_notes insert failed: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.activity_logs(
      user_id, action, entity_type, entity_id,
      actor_role, actor_name, details
    ) VALUES (
      _client_id, _event, COALESCE(_entity_type, 'client'), COALESCE(_entity_id, _client_id),
      'system_auto', SYSTEM_NAME,
      jsonb_build_object('note', _body)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[auto_note] activity_logs insert failed: %', SQLERRM;
  END;
END;
$$;

-- Resolver helpers ----------------------------------------------------
CREATE OR REPLACE FUNCTION public._resolve_client_from_account(_account_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT client_id FROM public.accounts WHERE id = _account_id;
$$;

CREATE OR REPLACE FUNCTION public._resolve_client_from_billing_customer(_bc_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id FROM public.billing_customers WHERE id = _bc_id;
$$;

CREATE OR REPLACE FUNCTION public._fmt_money(_n NUMERIC)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN _n IS NULL THEN '—'
              ELSE trim(to_char(_n, 'FM999G999G990D00')) || ' $' END;
$$;

-- =====================================================================
-- 1) accounts — status transitions (suspend / reactivate / cancel / pause)
-- =====================================================================
CREATE OR REPLACE FUNCTION public._trg_note_account_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _label TEXT;
  _event TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    CASE lower(coalesce(NEW.status,''))
      WHEN 'suspended', 'suspend' THEN
        _event := 'account_suspended';
        _label := 'Compte suspendu' || COALESCE(' — ' || NEW.cancellation_reason, '');
      WHEN 'active', 'reactivated' THEN
        _event := 'account_reactivated';
        _label := 'Compte réactivé';
      WHEN 'cancelled', 'canceled', 'closed', 'terminated' THEN
        _event := 'account_cancelled';
        _label := 'Compte annulé' || COALESCE(' — ' || NEW.cancellation_reason, '');
      WHEN 'paused', 'pause' THEN
        _event := 'account_paused';
        _label := 'Compte en pause'
          || COALESCE(' — jusqu''au ' || to_char(NEW.paused_until, 'YYYY-MM-DD'), '')
          || COALESCE(' — ' || NEW.pause_reason, '');
      ELSE
        _event := 'account_status_changed';
        _label := 'Statut du compte : ' || OLD.status || ' → ' || NEW.status;
    END CASE;
    PERFORM public._write_client_auto_note(NEW.client_id, _event, _label, 'account', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_note_account_status ON public.accounts;
CREATE TRIGGER trg_note_account_status
AFTER UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public._trg_note_account_status();

-- =====================================================================
-- 2) service_addresses — nouvelle adresse ajoutée
-- =====================================================================
CREATE OR REPLACE FUNCTION public._trg_note_service_address_added()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _client UUID; _body TEXT;
BEGIN
  _client := public._resolve_client_from_account(NEW.account_id);
  _body := 'Adresse de service ajoutée — '
        || COALESCE(NEW.address_line,'') || ', '
        || COALESCE(NEW.city,'') || ' (' || COALESCE(NEW.postal_code,'') || ')';
  PERFORM public._write_client_auto_note(_client, 'service_address_added', _body, 'account', NEW.account_id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_note_service_address_added ON public.service_addresses;
CREATE TRIGGER trg_note_service_address_added
AFTER INSERT ON public.service_addresses
FOR EACH ROW EXECUTE FUNCTION public._trg_note_service_address_added();

-- =====================================================================
-- 3) support_tickets — ouverture / fermeture
-- =====================================================================
CREATE OR REPLACE FUNCTION public._trg_note_support_ticket()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _client UUID; _body TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _client := COALESCE(NEW.user_id, NEW.owner_user_id, NEW.created_by_user_id);
    _body := 'Ticket support ouvert #' || COALESCE(NEW.ticket_number, substring(NEW.id::text,1,8))
          || COALESCE(' — ' || NEW.subject, '');
    PERFORM public._write_client_auto_note(_client, 'ticket_created', _body, 'ticket', NEW.id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
        AND lower(NEW.status) IN ('resolved','closed') THEN
    _client := COALESCE(NEW.user_id, NEW.owner_user_id, NEW.created_by_user_id);
    _body := 'Ticket support fermé #' || COALESCE(NEW.ticket_number, substring(NEW.id::text,1,8))
          || ' — ' || NEW.status;
    PERFORM public._write_client_auto_note(_client, 'ticket_closed', _body, 'ticket', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_note_support_ticket ON public.support_tickets;
CREATE TRIGGER trg_note_support_ticket
AFTER INSERT OR UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public._trg_note_support_ticket();

-- =====================================================================
-- 4) payment_disputes — litige ouvert / résolu
-- =====================================================================
CREATE OR REPLACE FUNCTION public._trg_note_payment_dispute()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _body TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _body := 'Litige de paiement ouvert #' || COALESCE(NEW.dispute_number, substring(NEW.id::text,1,8))
          || COALESCE(' — motif : ' || NEW.reason_code, '');
    PERFORM public._write_client_auto_note(NEW.user_id, 'dispute_opened', _body, 'dispute', NEW.id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
        AND lower(NEW.status) IN ('resolved','approved','rejected','closed') THEN
    _body := 'Litige de paiement ' || NEW.status || ' #'
          || COALESCE(NEW.dispute_number, substring(NEW.id::text,1,8));
    PERFORM public._write_client_auto_note(NEW.user_id, 'dispute_resolved', _body, 'dispute', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_note_payment_dispute ON public.payment_disputes;
CREATE TRIGGER trg_note_payment_dispute
AFTER INSERT OR UPDATE ON public.payment_disputes
FOR EACH ROW EXECUTE FUNCTION public._trg_note_payment_dispute();

-- =====================================================================
-- 5) collections_actions — cas de recouvrement
-- =====================================================================
CREATE OR REPLACE FUNCTION public._trg_note_collections_action()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _client UUID; _body TEXT;
BEGIN
  _client := public._resolve_client_from_billing_customer(NEW.customer_id);
  _body := 'Action de recouvrement — ' || COALESCE(NEW.action_type,'action')
        || COALESCE(' — promesse ' || public._fmt_money(NEW.amount_promised), '');
  PERFORM public._write_client_auto_note(_client, 'collections_action', _body, 'collections', NEW.id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_note_collections_action ON public.collections_actions;
CREATE TRIGGER trg_note_collections_action
AFTER INSERT ON public.collections_actions
FOR EACH ROW EXECUTE FUNCTION public._trg_note_collections_action();

-- =====================================================================
-- 6) billing_invoices — facture créée / en retard
-- =====================================================================
CREATE OR REPLACE FUNCTION public._trg_note_billing_invoice()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
        AND lower(NEW.status) IN ('overdue','past_due','late') THEN
    _body := 'Facture en retard #' || COALESCE(NEW.invoice_number, substring(NEW.id::text,1,8))
          || ' — ' || public._fmt_money(NEW.balance_due)
          || COALESCE(' — depuis ' || to_char(NEW.due_date, 'YYYY-MM-DD'), '');
    PERFORM public._write_client_auto_note(_client, 'invoice_overdue', _body, 'invoice', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_note_billing_invoice ON public.billing_invoices;
CREATE TRIGGER trg_note_billing_invoice
AFTER INSERT OR UPDATE ON public.billing_invoices
FOR EACH ROW EXECUTE FUNCTION public._trg_note_billing_invoice();

-- =====================================================================
-- 7) client_direct_refunds — remboursement émis
-- =====================================================================
CREATE OR REPLACE FUNCTION public._trg_note_direct_refund()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _body TEXT;
BEGIN
  IF (TG_OP = 'INSERT' AND lower(coalesce(NEW.status,'')) IN ('processed','approved','completed'))
     OR (TG_OP = 'UPDATE'
         AND NEW.status IS DISTINCT FROM OLD.status
         AND lower(NEW.status) IN ('processed','approved','completed')) THEN
    _body := 'Remboursement émis — ' || public._fmt_money(NEW.amount)
          || COALESCE(' — ' || NEW.refund_method, '')
          || COALESCE(' — Réf ' || NEW.external_reference, '')
          || COALESCE(' — motif : ' || NEW.reason, '');
    PERFORM public._write_client_auto_note(NEW.user_id, 'refund_issued', _body, 'refund', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_note_direct_refund ON public.client_direct_refunds;
CREATE TRIGGER trg_note_direct_refund
AFTER INSERT OR UPDATE ON public.client_direct_refunds
FOR EACH ROW EXECUTE FUNCTION public._trg_note_direct_refund();

-- =====================================================================
-- 8) account_promotions — promo appliquée / expirée
-- =====================================================================
CREATE OR REPLACE FUNCTION public._trg_note_account_promotion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _client UUID; _body TEXT;
BEGIN
  _client := public._resolve_client_from_account(NEW.account_id);
  IF TG_OP = 'INSERT' THEN
    _body := 'Promotion appliquée — ' || COALESCE(NEW.label, NEW.promo_code, 'promotion')
          || ' — ' || public._fmt_money(NEW.amount)
          || CASE WHEN NEW.duration_months IS NOT NULL AND NEW.duration_months > 1
                  THEN ' — ' || NEW.duration_months || ' mois' ELSE '' END;
    PERFORM public._write_client_auto_note(_client, 'promotion_added', _body, 'promotion', NEW.id);
  ELSIF TG_OP = 'UPDATE' AND OLD.is_active = true AND NEW.is_active = false THEN
    _body := 'Promotion retirée — ' || COALESCE(NEW.label, NEW.promo_code, 'promotion');
    PERFORM public._write_client_auto_note(_client, 'promotion_removed', _body, 'promotion', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_note_account_promotion ON public.account_promotions;
CREATE TRIGGER trg_note_account_promotion
AFTER INSERT OR UPDATE ON public.account_promotions
FOR EACH ROW EXECUTE FUNCTION public._trg_note_account_promotion();

-- =====================================================================
-- 9) equipment_return_requests — retour équipement
-- =====================================================================
CREATE OR REPLACE FUNCTION public._trg_note_equipment_return()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _body TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _body := 'Retour d''équipement demandé' || COALESCE(' — ' || NEW.reason, '');
    PERFORM public._write_client_auto_note(NEW.client_user_id, 'equipment_return_requested', _body, 'return', NEW.id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
        AND lower(NEW.status) IN ('completed','received') THEN
    _body := 'Retour d''équipement ' || NEW.status
          || COALESCE(' — remboursement ' || public._fmt_money(NEW.refund_amount), '');
    PERFORM public._write_client_auto_note(NEW.client_user_id, 'equipment_returned', _body, 'return', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_note_equipment_return ON public.equipment_return_requests;
CREATE TRIGGER trg_note_equipment_return
AFTER INSERT OR UPDATE ON public.equipment_return_requests
FOR EACH ROW EXECUTE FUNCTION public._trg_note_equipment_return();

-- =====================================================================
-- 10) shipments — expédié / livré
-- =====================================================================
CREATE OR REPLACE FUNCTION public._trg_note_shipment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _client UUID; _body TEXT; _event TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    _client := public._resolve_client_from_billing_customer(NEW.customer_id);
    IF lower(NEW.status) IN ('shipped','in_transit') THEN
      _event := 'shipment_shipped';
      _body  := 'Équipement expédié'
             || COALESCE(' — ' || NEW.carrier, '')
             || COALESCE(' — suivi ' || NEW.tracking_number, '');
    ELSIF lower(NEW.status) = 'delivered' THEN
      _event := 'shipment_delivered';
      _body  := 'Équipement livré'
             || COALESCE(' — ' || to_char(NEW.actual_delivery_date, 'YYYY-MM-DD'), '');
    ELSE
      RETURN NEW;
    END IF;
    PERFORM public._write_client_auto_note(_client, _event, _body, 'shipment', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_note_shipment ON public.shipments;
CREATE TRIGGER trg_note_shipment
AFTER UPDATE ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public._trg_note_shipment();

-- =====================================================================
-- 11) privacy_requests — Loi 25 reçue / complétée
-- =====================================================================
CREATE OR REPLACE FUNCTION public._trg_note_privacy_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _body TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _body := 'Demande Loi 25 reçue — ' || COALESCE(NEW.request_type, 'demande');
    PERFORM public._write_client_auto_note(NEW.client_id, 'privacy_request_received', _body, 'privacy', NEW.id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
        AND lower(NEW.status) IN ('completed','resolved','refused') THEN
    _body := 'Demande Loi 25 ' || NEW.status || ' — ' || COALESCE(NEW.request_type,'');
    PERFORM public._write_client_auto_note(NEW.client_id, 'privacy_request_processed', _body, 'privacy', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_note_privacy_request ON public.privacy_requests;
CREATE TRIGGER trg_note_privacy_request
AFTER INSERT OR UPDATE ON public.privacy_requests
FOR EACH ROW EXECUTE FUNCTION public._trg_note_privacy_request();

-- =====================================================================
-- 12) defective_equipment_alerts — équipement défectueux
-- =====================================================================
CREATE OR REPLACE FUNCTION public._trg_note_defective_equipment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _client UUID; _body TEXT;
BEGIN
  _client := public._resolve_client_from_account(NEW.account_id);
  _body := 'Équipement défectueux signalé — ' || COALESCE(NEW.catalog_name, NEW.category, 'équipement')
        || COALESCE(' — S/N ' || NEW.serial_number, '')
        || COALESCE(' — ' || NEW.notes, '');
  PERFORM public._write_client_auto_note(_client, 'equipment_defective_reported', _body, 'equipment', NEW.equipment_id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_note_defective_equipment ON public.defective_equipment_alerts;
CREATE TRIGGER trg_note_defective_equipment
AFTER INSERT ON public.defective_equipment_alerts
FOR EACH ROW EXECUTE FUNCTION public._trg_note_defective_equipment();

-- =====================================================================
-- 13) service_cancellation_requests — demande d'annulation
-- =====================================================================
CREATE OR REPLACE FUNCTION public._trg_note_service_cancellation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _body TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _body := 'Demande d''annulation de service — ' || COALESCE(NEW.service_type,'service')
          || COALESCE(' — motif : ' || NEW.reason_code, '')
          || COALESCE(' — effective ' || to_char(NEW.requested_effective_date, 'YYYY-MM-DD'), '');
    PERFORM public._write_client_auto_note(NEW.user_id, 'service_cancellation_requested', _body, 'cancellation', NEW.id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
        AND lower(NEW.status) IN ('completed','approved','declined','processed') THEN
    _body := 'Demande d''annulation ' || NEW.status || ' — ' || COALESCE(NEW.service_type,'');
    PERFORM public._write_client_auto_note(NEW.user_id, 'service_cancellation_processed', _body, 'cancellation', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_note_service_cancellation ON public.service_cancellation_requests;
CREATE TRIGGER trg_note_service_cancellation
AFTER INSERT OR UPDATE ON public.service_cancellation_requests
FOR EACH ROW EXECUTE FUNCTION public._trg_note_service_cancellation();

-- =====================================================================
-- 14) installation_jobs — installation complétée
-- =====================================================================
CREATE OR REPLACE FUNCTION public._trg_note_installation_job()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _client UUID; _body TEXT; _tech TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND lower(NEW.status) IN ('completed','done') THEN
    _client := public._resolve_client_from_account(NEW.account_id);
    SELECT COALESCE(display_name, full_name, email)
      INTO _tech FROM public.profiles WHERE id = NEW.technician_id;
    _body := 'Installation complétée #' || COALESCE(NEW.job_number, substring(NEW.id::text,1,8))
          || COALESCE(' — ' || NEW.service_type, '')
          || COALESCE(' — technicien : ' || _tech, '')
          || COALESCE(' — le ' || to_char(NEW.completed_at, 'YYYY-MM-DD'), '');
    PERFORM public._write_client_auto_note(_client, 'installation_completed', _body, 'installation', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_note_installation_job ON public.installation_jobs;
CREATE TRIGGER trg_note_installation_job
AFTER UPDATE ON public.installation_jobs
FOR EACH ROW EXECUTE FUNCTION public._trg_note_installation_job();

-- =====================================================================
-- 15) client_login_pins — NIP réinitialisé (nouvelle demande PIN)
-- Chaque INSERT correspond à une émission de PIN par admin/self
-- =====================================================================
CREATE OR REPLACE FUNCTION public._trg_note_client_login_pin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._write_client_auto_note(
    NEW.user_id, 'pin_reset',
    'NIP de connexion émis' || COALESCE(' — expire ' || to_char(NEW.expires_at, 'YYYY-MM-DD HH24:MI'), ''),
    'auth', NEW.user_id
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_note_client_login_pin ON public.client_login_pins;
CREATE TRIGGER trg_note_client_login_pin
AFTER INSERT ON public.client_login_pins
FOR EACH ROW EXECUTE FUNCTION public._trg_note_client_login_pin();
