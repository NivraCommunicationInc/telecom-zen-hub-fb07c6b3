
-- Auto-lier chaque commande + rendez-vous à une service_address pour synchronisation Core/Portail

CREATE OR REPLACE FUNCTION public.fn_resolve_account_service_address_id(_account_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT sa.id
  FROM public.service_addresses sa
  WHERE sa.account_id = _account_id
    AND sa.deleted_at IS NULL
  ORDER BY sa.is_primary DESC NULLS LAST, sa.is_active DESC NULLS LAST, sa.created_at ASC
  LIMIT 1
$$;

-- Trigger: orders.service_address_id auto-résolu depuis account_id
CREATE OR REPLACE FUNCTION public.fn_normalize_order_service_address()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
BEGIN
  IF NEW.service_address_id IS NULL THEN
    v_account_id := NEW.account_id;
    IF v_account_id IS NULL AND NEW.user_id IS NOT NULL THEN
      SELECT a.id INTO v_account_id
      FROM public.accounts a
      WHERE a.client_id = NEW.user_id
      ORDER BY a.created_at ASC
      LIMIT 1;
    END IF;
    IF v_account_id IS NOT NULL THEN
      NEW.service_address_id := public.fn_resolve_account_service_address_id(v_account_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_order_service_address ON public.orders;
CREATE TRIGGER trg_normalize_order_service_address
BEFORE INSERT OR UPDATE OF account_id, user_id, service_address_id ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.fn_normalize_order_service_address();

-- Trigger: appointments.service_address_id auto-résolu depuis order/client
CREATE OR REPLACE FUNCTION public.fn_normalize_appointment_service_address()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
BEGIN
  IF NEW.service_address_id IS NULL THEN
    IF NEW.order_id IS NOT NULL THEN
      SELECT o.service_address_id, o.account_id
      INTO NEW.service_address_id, v_account_id
      FROM public.orders o WHERE o.id = NEW.order_id;
    END IF;
    IF NEW.service_address_id IS NULL AND NEW.client_id IS NOT NULL THEN
      IF v_account_id IS NULL THEN
        SELECT a.id INTO v_account_id
        FROM public.accounts a
        WHERE a.client_id = NEW.client_id
        ORDER BY a.created_at ASC LIMIT 1;
      END IF;
      IF v_account_id IS NOT NULL THEN
        NEW.service_address_id := public.fn_resolve_account_service_address_id(v_account_id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_appointment_service_address ON public.appointments;
CREATE TRIGGER trg_normalize_appointment_service_address
BEFORE INSERT OR UPDATE OF order_id, client_id, service_address_id ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.fn_normalize_appointment_service_address();

-- Backfill: commandes existantes
UPDATE public.orders o
SET service_address_id = public.fn_resolve_account_service_address_id(o.account_id)
WHERE o.service_address_id IS NULL
  AND o.account_id IS NOT NULL;

UPDATE public.orders o
SET service_address_id = public.fn_resolve_account_service_address_id(a.id)
FROM public.accounts a
WHERE o.service_address_id IS NULL
  AND o.account_id IS NULL
  AND a.client_id = o.user_id;

-- Backfill: rendez-vous depuis order
UPDATE public.appointments ap
SET service_address_id = o.service_address_id
FROM public.orders o
WHERE ap.service_address_id IS NULL
  AND ap.order_id = o.id
  AND o.service_address_id IS NOT NULL;

-- Backfill: rendez-vous restants via client_id
UPDATE public.appointments ap
SET service_address_id = public.fn_resolve_account_service_address_id(a.id)
FROM public.accounts a
WHERE ap.service_address_id IS NULL
  AND ap.client_id IS NOT NULL
  AND a.client_id = ap.client_id;

-- Rafraîchir les snapshots des clients concernés
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT client_id FROM public.appointments WHERE client_id IS NOT NULL
    UNION
    SELECT DISTINCT user_id FROM public.orders WHERE user_id IS NOT NULL
  LOOP
    BEGIN
      PERFORM public.refresh_customer_portal_snapshot_internal(r.client_id, 'backfill_service_address', NULL);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
