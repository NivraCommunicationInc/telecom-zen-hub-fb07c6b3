
-- Trigger: enqueue notification_outbox emails on KYC session status changes
CREATE OR REPLACE FUNCTION public.notify_kyc_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_name text;
  v_case_number text;
  v_order_number text;
  v_event_type text;
  v_subject text;
  v_reason text;
BEGIN
  -- Only fire when status actually changes
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Only handle statuses that need emails
  IF NEW.status NOT IN ('pending_docs', 'approved', 'rejected', 'submitted') THEN
    RETURN NEW;
  END IF;

  -- Get client info
  SELECT p.email, p.full_name INTO v_email, v_name
  FROM profiles p WHERE p.id = NEW.user_id;

  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  v_case_number := COALESCE(NEW.case_number, '');
  v_order_number := COALESCE(NEW.order_number, '');
  v_reason := COALESCE(NEW.review_reason, '');

  -- Determine event type and subject
  CASE NEW.status
    WHEN 'pending_docs' THEN
      v_event_type := 'KYC_DOC_REQUESTED';
      v_subject := 'Documents requis — Dossier ' || v_case_number;
    WHEN 'approved' THEN
      v_event_type := 'KYC_APPROVED';
      v_subject := 'Vérification approuvée — Dossier ' || v_case_number;
    WHEN 'rejected' THEN
      v_event_type := 'KYC_REJECTED';
      v_subject := 'Vérification refusée — Dossier ' || v_case_number;
    WHEN 'submitted' THEN
      -- Email to admin, not client — we'll handle recipient differently
      v_event_type := 'KYC_SUBMITTED';
      v_subject := 'Nouvelle soumission KYC — ' || v_case_number;
    ELSE
      RETURN NEW;
  END CASE;

  -- For 'submitted', notify admin instead of client
  IF NEW.status = 'submitted' THEN
    INSERT INTO notification_outbox (event_type, recipient, to_email, to_name, subject, status, payload_json)
    VALUES (
      v_event_type,
      'admin',
      'Support@nivra-telecom.ca',
      'Équipe Nivra',
      v_subject,
      'queued',
      jsonb_build_object(
        'case_number', v_case_number,
        'order_number', v_order_number,
        'client_name', v_name,
        'client_email', v_email,
        'session_id', NEW.id
      )
    );
  ELSE
    -- Notify client
    INSERT INTO notification_outbox (event_type, recipient, to_email, to_name, subject, status, payload_json)
    VALUES (
      v_event_type,
      'client',
      v_email,
      v_name,
      v_subject,
      'queued',
      jsonb_build_object(
        'case_number', v_case_number,
        'order_number', v_order_number,
        'client_name', v_name,
        'reason', v_reason,
        'session_id', NEW.id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Drop if exists to avoid duplicate
DROP TRIGGER IF EXISTS trg_notify_kyc_status_change ON public.identity_verification_sessions;

CREATE TRIGGER trg_notify_kyc_status_change
  AFTER UPDATE ON public.identity_verification_sessions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_kyc_status_change();
