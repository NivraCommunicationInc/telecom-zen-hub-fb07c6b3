CREATE OR REPLACE FUNCTION public.validate_contract_status_transition(
  p_old_status text,
  p_new_status text
) RETURNS boolean AS $$
DECLARE
  v_allowed_transitions jsonb;
BEGIN
  v_allowed_transitions := jsonb_build_object(
    'draft', '["waiting_client_signature", "signed_by_client", "signed_by_admin", "fully_signed", "sent", "void"]'::jsonb,
    'waiting_client_signature', '["signed_by_client", "signed_by_admin", "fully_signed", "void", "superseded"]'::jsonb,
    'signed_by_client', '["fully_signed", "signed_by_admin", "void", "superseded"]'::jsonb,
    'signed_by_admin', '["fully_signed", "signed_by_client", "void", "superseded"]'::jsonb,
    'fully_signed', '["void", "superseded"]'::jsonb,
    'sent', '["waiting_client_signature", "signed_by_client", "signed_by_admin", "fully_signed", "void", "superseded"]'::jsonb,
    'void', '[]'::jsonb,
    'superseded', '[]'::jsonb
  );

  IF p_old_status = p_new_status THEN RETURN true; END IF;
  IF p_old_status IS NULL THEN RETURN true; END IF;

  IF v_allowed_transitions ? p_old_status THEN
    RETURN v_allowed_transitions->p_old_status ? p_new_status;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;