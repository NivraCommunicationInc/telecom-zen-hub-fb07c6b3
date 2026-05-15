
CREATE OR REPLACE FUNCTION public.fn_assign_agent_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number TEXT;
  v_existing TEXT;
  v_pro_email TEXT;
BEGIN
  SELECT agent_number INTO v_existing
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  IF v_existing IS NULL THEN
    v_number := public.generate_agent_number(NEW.role::TEXT);

    SELECT REGEXP_REPLACE(
      LOWER(SPLIT_PART(COALESCE(first_name, SPLIT_PART(full_name, ' ', 1), 'agent'), ' ', 1)),
      '[^a-z0-9]', '', 'g'
    ) || '@nivra-telecom.ca'
    INTO v_pro_email
    FROM public.profiles
    WHERE user_id = NEW.user_id;

    UPDATE public.profiles
    SET agent_number = v_number,
        professional_email = COALESCE(professional_email, v_pro_email)
    WHERE user_id = NEW.user_id
      AND agent_number IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.profiles p
SET professional_email = REGEXP_REPLACE(
  LOWER(SPLIT_PART(COALESCE(p.first_name, SPLIT_PART(p.full_name, ' ', 1), 'agent'), ' ', 1)),
  '[^a-z0-9]', '', 'g'
) || '@nivra-telecom.ca'
WHERE p.agent_number IS NOT NULL;
