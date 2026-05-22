
-- Cleanup audit test rows
DELETE FROM public.complaints WHERE submitted_by_email LIKE 'audit%@test.invalid';

-- SECURITY DEFINER RPC: allows anon to submit a complaint and get ticket_number + public_token back
CREATE OR REPLACE FUNCTION public.submit_public_complaint(
  p_name text,
  p_email text,
  p_phone text,
  p_category text,
  p_subject text,
  p_description text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.complaints%ROWTYPE;
BEGIN
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_required');
  END IF;
  IF p_subject IS NULL OR length(trim(p_subject)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'subject_required');
  END IF;
  IF p_description IS NULL OR length(trim(p_description)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'description_required');
  END IF;
  IF p_category NOT IN ('technique','facturation','service_client','installation','equipement','resiliation','autre') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_category');
  END IF;

  INSERT INTO public.complaints (
    submitted_by_name, submitted_by_email, submitted_by_phone,
    category, subject, description, priority, status
  ) VALUES (
    nullif(trim(p_name), ''),
    trim(p_email),
    nullif(trim(p_phone), ''),
    p_category,
    trim(p_subject),
    trim(p_description),
    'normal',
    'new'
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'ticket_number', v_row.ticket_number,
    'public_token', v_row.public_token
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_complaint(text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_complaint(text,text,text,text,text,text) TO anon, authenticated;
