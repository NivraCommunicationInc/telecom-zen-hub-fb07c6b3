
-- =====================================================================
-- Final certification exam + 12-month recertification
-- =====================================================================

-- 1) Exam attempts table -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  portal text NOT NULL CHECK (portal IN ('field','cs')),
  question_ids uuid[] NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  score integer,
  passed boolean,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted','expired')),
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 minutes')
);

CREATE INDEX IF NOT EXISTS ix_exam_attempts_agent ON public.training_exam_attempts (agent_id, started_at DESC);

ALTER TABLE public.training_exam_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_exam_attempts_read ON public.training_exam_attempts;
CREATE POLICY p_exam_attempts_read ON public.training_exam_attempts
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid()
         OR has_role(auth.uid(),'admin'::app_role)
         OR has_role(auth.uid(),'supervisor'::app_role));

DROP POLICY IF EXISTS p_exam_attempts_write ON public.training_exam_attempts;
CREATE POLICY p_exam_attempts_write ON public.training_exam_attempts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)
         OR has_role(auth.uid(),'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role)
              OR has_role(auth.uid(),'supervisor'::app_role));

-- 2) Add portal to certifications + auto 12 month expiry ----------------
ALTER TABLE public.training_certifications
  ADD COLUMN IF NOT EXISTS portal text;

ALTER TABLE public.training_certifications
  ADD COLUMN IF NOT EXISTS exam_score integer;

CREATE OR REPLACE FUNCTION public.fn_set_cert_default_expiry()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := COALESCE(NEW.issued_at, now()) + interval '12 months';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cert_default_expiry ON public.training_certifications;
CREATE TRIGGER trg_cert_default_expiry
BEFORE INSERT OR UPDATE OF issued_at ON public.training_certifications
FOR EACH ROW EXECUTE FUNCTION public.fn_set_cert_default_expiry();

-- Backfill expiry on existing rows
UPDATE public.training_certifications
SET expires_at = issued_at + interval '12 months'
WHERE expires_at IS NULL;

-- 3) Updated gate: non-expired cert required ----------------------------
CREATE OR REPLACE FUNCTION public.fn_check_portal_certification(_user_id uuid, _portal text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.training_certification_whitelist w WHERE w.user_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.training_certifications c
      WHERE c.agent_id = _user_id
        AND c.is_active = true
        AND (c.portal IS NULL OR c.portal = _portal OR c.portal = 'both')
        AND (c.expires_at IS NULL OR c.expires_at > now())
    );
$$;

-- 4) Certification status ----------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_certification_status(_user_id uuid, _portal text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_cert public.training_certifications%ROWTYPE;
  v_days int;
  v_status text;
  v_modules_total int;
  v_modules_done int;
  v_last_attempt public.training_exam_attempts%ROWTYPE;
  v_cooldown_until timestamptz;
BEGIN
  -- Latest active cert applicable to portal
  SELECT * INTO v_cert
  FROM public.training_certifications
  WHERE agent_id = _user_id
    AND is_active = true
    AND (portal IS NULL OR portal = _portal OR portal = 'both')
  ORDER BY issued_at DESC LIMIT 1;

  -- Module completion progress
  SELECT count(*) INTO v_modules_total
  FROM public.training_modules
  WHERE is_active = true AND is_mandatory = true AND (portal = _portal OR portal = 'both');

  SELECT count(*) INTO v_modules_done
  FROM public.training_modules m
  JOIN public.training_progress p
    ON p.module_id = m.id AND p.agent_id = _user_id
  WHERE m.is_active = true AND m.is_mandatory = true
    AND (m.portal = _portal OR m.portal = 'both')
    AND p.status = 'completed' AND p.score >= m.passing_score;

  -- Last attempt + cooldown (24h after a failed attempt)
  SELECT * INTO v_last_attempt
  FROM public.training_exam_attempts
  WHERE agent_id = _user_id AND portal = _portal AND status = 'submitted'
  ORDER BY submitted_at DESC LIMIT 1;

  IF v_last_attempt.id IS NOT NULL AND v_last_attempt.passed = false THEN
    v_cooldown_until := v_last_attempt.submitted_at + interval '24 hours';
    IF v_cooldown_until <= now() THEN v_cooldown_until := NULL; END IF;
  END IF;

  IF v_cert.id IS NULL THEN
    v_status := 'none';
    v_days := NULL;
  ELSE
    v_days := GREATEST(0, EXTRACT(EPOCH FROM (v_cert.expires_at - now()))::int / 86400);
    IF v_cert.expires_at <= now() THEN
      v_status := 'expired';
    ELSIF v_days <= 30 THEN
      v_status := 'expiring_soon';
    ELSE
      v_status := 'valid';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'status', v_status,
    'expires_at', v_cert.expires_at,
    'issued_at', v_cert.issued_at,
    'days_until_expiry', v_days,
    'exam_score', v_cert.exam_score,
    'modules_total', v_modules_total,
    'modules_done', v_modules_done,
    'all_modules_done', (v_modules_total > 0 AND v_modules_done >= v_modules_total),
    'cooldown_until', v_cooldown_until,
    'can_take_exam', (v_modules_total > 0
                      AND v_modules_done >= v_modules_total
                      AND v_cooldown_until IS NULL)
  );
END;
$$;

-- 5) Start a new exam attempt ------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_start_final_exam(_portal text, _question_count int DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_status jsonb;
  v_qids uuid[];
  v_attempt public.training_exam_attempts%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  v_status := public.fn_certification_status(v_user, _portal);

  IF (v_status->>'can_take_exam')::boolean = false THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_eligible', 'status', v_status);
  END IF;

  -- Pick random questions from mandatory modules of this portal
  SELECT array_agg(q.id ORDER BY random())
    INTO v_qids
  FROM public.training_questions q
  JOIN public.training_modules m ON m.id = q.module_id
  WHERE m.is_active = true AND m.is_mandatory = true
    AND (m.portal = _portal OR m.portal = 'both');

  IF v_qids IS NULL OR array_length(v_qids, 1) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_questions');
  END IF;

  -- Trim to requested count
  IF array_length(v_qids, 1) > _question_count THEN
    v_qids := v_qids[1:_question_count];
  END IF;

  INSERT INTO public.training_exam_attempts (agent_id, portal, question_ids, expires_at)
  VALUES (v_user, _portal, v_qids, now() + interval '60 minutes')
  RETURNING * INTO v_attempt;

  RETURN jsonb_build_object('ok', true, 'attempt_id', v_attempt.id,
                            'question_ids', v_qids,
                            'expires_at', v_attempt.expires_at);
END;
$$;

-- 6) Submit final exam --------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_submit_final_exam(_attempt_id uuid, _answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_attempt public.training_exam_attempts%ROWTYPE;
  v_total int := 0;
  v_correct int := 0;
  v_score int;
  v_passed boolean;
  v_qid uuid;
  v_correct_opt int;
  v_chosen int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;

  SELECT * INTO v_attempt FROM public.training_exam_attempts WHERE id = _attempt_id;
  IF v_attempt.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_attempt.agent_id <> v_user
     AND NOT (has_role(v_user,'admin'::app_role) OR has_role(v_user,'supervisor'::app_role)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF v_attempt.status <> 'in_progress' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_submitted');
  END IF;

  -- Grade
  FOREACH v_qid IN ARRAY v_attempt.question_ids LOOP
    v_total := v_total + 1;
    SELECT correct_option INTO v_correct_opt FROM public.training_questions WHERE id = v_qid;
    v_chosen := NULLIF(_answers->>v_qid::text, '')::int;
    IF v_chosen IS NOT NULL AND v_chosen = v_correct_opt THEN
      v_correct := v_correct + 1;
    END IF;
  END LOOP;

  v_score := CASE WHEN v_total = 0 THEN 0 ELSE ROUND((v_correct::numeric / v_total) * 100)::int END;
  v_passed := v_score >= 80;

  UPDATE public.training_exam_attempts
    SET answers = _answers, score = v_score, passed = v_passed,
        status = 'submitted', submitted_at = now()
    WHERE id = _attempt_id;

  IF v_passed THEN
    -- Deactivate any existing cert for this portal then issue fresh
    UPDATE public.training_certifications
      SET is_active = false
      WHERE agent_id = v_attempt.agent_id
        AND is_active = true
        AND (portal IS NULL OR portal = v_attempt.portal OR portal = 'both');

    INSERT INTO public.training_certifications
      (agent_id, certification_name, certification_level, portal,
       total_points, exam_score, issued_at, expires_at, is_active)
    VALUES
      (v_attempt.agent_id,
       'Nivra Academy Certified — ' || CASE WHEN v_attempt.portal='field' THEN 'Field' ELSE 'OneView CS' END,
       'certified', v_attempt.portal,
       v_score, v_score, now(), now() + interval '12 months', true);
  END IF;

  RETURN jsonb_build_object('ok', true, 'score', v_score, 'passed', v_passed,
                            'correct', v_correct, 'total', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_start_final_exam(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_submit_final_exam(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_certification_status(uuid, text) TO authenticated;
