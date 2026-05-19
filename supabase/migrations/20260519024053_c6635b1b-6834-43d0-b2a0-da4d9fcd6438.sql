
-- ============================================================
-- Phase 1 CRM Prosper : LNNTE toggle + duplicate phone check
-- ============================================================

-- Normalize phone helper (digits only)
CREATE OR REPLACE FUNCTION public.crm_normalize_phone(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g');
$$;

-- ============================================================
-- crm_toggle_dnc : mark contact as LNNTE / DNC
-- ============================================================
CREATE OR REPLACE FUNCTION public.crm_toggle_dnc(
  p_contact_id uuid,
  p_dnc boolean,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  -- Only staff/admin can toggle
  IF NOT (
    public.has_role(v_uid, 'admin')
    OR public.has_role(v_uid, 'employee')
    OR public.has_role(v_uid, 'agent')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  UPDATE public.crm_contacts
  SET
    is_dnc = p_dnc,
    dnc_reason = CASE WHEN p_dnc THEN coalesce(p_reason, dnc_reason, 'Marqué LNNTE par agent') ELSE NULL END,
    call_status = CASE WHEN p_dnc THEN 'do_not_call'::text ELSE call_status END
  WHERE id = p_contact_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true, 'is_dnc', p_dnc);
END;
$$;

GRANT EXECUTE ON FUNCTION public.crm_toggle_dnc(uuid, boolean, text) TO authenticated;

-- ============================================================
-- crm_check_duplicate : returns true if a profile already has this phone
-- ============================================================
CREATE OR REPLACE FUNCTION public.crm_check_duplicate(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_norm text;
  v_count int;
  v_first_name text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  IF NOT (
    public.has_role(v_uid, 'admin')
    OR public.has_role(v_uid, 'employee')
    OR public.has_role(v_uid, 'agent')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  v_norm := public.crm_normalize_phone(p_phone);
  IF length(v_norm) < 7 THEN
    RETURN jsonb_build_object('ok', true, 'is_duplicate', false);
  END IF;

  SELECT count(*), max(coalesce(first_name, full_name, email))
  INTO v_count, v_first_name
  FROM public.profiles
  WHERE public.crm_normalize_phone(phone) = v_norm
     OR public.crm_normalize_phone(phone_e164) = v_norm;

  RETURN jsonb_build_object(
    'ok', true,
    'is_duplicate', v_count > 0,
    'match_count', v_count,
    'sample_name', v_first_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.crm_check_duplicate(text) TO authenticated;
