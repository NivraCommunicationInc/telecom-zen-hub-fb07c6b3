
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS agent_number TEXT,
  ADD COLUMN IF NOT EXISTS professional_email TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS badge_number TEXT GENERATED ALWAYS AS (agent_number) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_agent_number_unique
  ON public.profiles(agent_number)
  WHERE agent_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_agent_number(p_role TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_sequence INTEGER;
  v_number TEXT;
BEGIN
  v_prefix := CASE p_role
    WHEN 'field_sales' THEN 'AF26'
    WHEN 'employee' THEN 'CS26'
    WHEN 'technician' THEN 'TC26'
    WHEN 'admin' THEN 'AD31'
    WHEN 'hr' THEN 'CS26'
    ELSE 'CS26'
  END;

  SELECT COUNT(*) + 1 INTO v_sequence
  FROM public.profiles
  WHERE agent_number LIKE v_prefix || '%';

  v_number := v_prefix || LPAD(v_sequence::TEXT, 4, '0');

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE agent_number = v_number) LOOP
    v_sequence := v_sequence + 1;
    v_number := v_prefix || LPAD(v_sequence::TEXT, 4, '0');
  END LOOP;

  RETURN v_number;
END;
$$;

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

    SELECT LOWER(REGEXP_REPLACE(
      SPLIT_PART(COALESCE(first_name, SPLIT_PART(full_name, ' ', 1), 'agent'), ' ', 1),
      '[^a-z0-9]', '', 'g'
    )) || '@nivra-telecom.ca'
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

DROP TRIGGER IF EXISTS trg_assign_agent_number ON public.user_roles;

CREATE TRIGGER trg_assign_agent_number
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.fn_assign_agent_number();

DO $$
DECLARE
  v_rec RECORD;
  v_number TEXT;
  v_pro_email TEXT;
BEGIN
  FOR v_rec IN
    SELECT DISTINCT ur.user_id, ur.role::TEXT AS role,
      p.first_name, p.full_name, p.email
    FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.role::TEXT IN ('field_sales','employee','technician','admin','hr')
      AND ur.is_active = true
      AND p.agent_number IS NULL
    ORDER BY ur.role::TEXT, p.full_name
  LOOP
    v_number := public.generate_agent_number(v_rec.role);
    v_pro_email := LOWER(REGEXP_REPLACE(
      SPLIT_PART(COALESCE(v_rec.first_name, SPLIT_PART(v_rec.full_name, ' ', 1), 'agent'), ' ', 1),
      '[^a-z0-9]', '', 'g'
    )) || '@nivra-telecom.ca';

    UPDATE public.profiles
    SET agent_number = v_number,
        professional_email = COALESCE(professional_email, v_pro_email)
    WHERE user_id = v_rec.user_id
      AND agent_number IS NULL;
  END LOOP;
END $$;
