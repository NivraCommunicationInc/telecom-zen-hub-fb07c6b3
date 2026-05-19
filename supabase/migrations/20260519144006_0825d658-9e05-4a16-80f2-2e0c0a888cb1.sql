
CREATE TABLE IF NOT EXISTS public.job_applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  city TEXT,
  postal_code TEXT,
  date_of_birth DATE,
  languages TEXT[],
  available_equipment TEXT[],
  can_travel BOOLEAN DEFAULT true,
  assigned_territory TEXT,
  territories TEXT[],
  availability_start TEXT,
  availability_days TEXT,
  hours_per_week TEXT,
  sales_experience TEXT,
  door_to_door_experience TEXT,
  accepts_commission_only BOOLEAN DEFAULT true,
  resume_url TEXT,
  notes TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN (
    'new','invited','interview_pending','interview_completed','reviewing',
    'accepted','rejected','hired','no_show','withdrawn','excluded'
  )),
  interview_token UUID DEFAULT gen_random_uuid() UNIQUE,
  interview_language TEXT DEFAULT 'fr' CHECK (interview_language IN ('fr','en')),
  interview_started_at TIMESTAMPTZ,
  interview_completed_at TIMESTAMPTZ,
  interview_score INTEGER CHECK (interview_score BETWEEN 0 AND 10),
  interview_recommendation TEXT CHECK (interview_recommendation IN (
    'strongly_recommend','recommend','neutral','not_recommend','strongly_not_recommend'
  )),
  interview_notes TEXT,
  interview_strengths TEXT[],
  interview_concerns TEXT[],
  interview_red_flags TEXT[],
  invitation_sent_at TIMESTAMPTZ,
  contract_sent_at TIMESTAMPTZ,
  contract_signed_at TIMESTAMPTZ,
  hired_at TIMESTAMPTZ,
  hired_by UUID REFERENCES public.profiles(user_id),
  skip_interview BOOLEAN DEFAULT false,
  skip_reason TEXT,
  source TEXT DEFAULT 'manual',
  applied_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_applicants_status ON public.job_applicants(status);
CREATE INDEX IF NOT EXISTS idx_job_applicants_email ON public.job_applicants(email);
CREATE INDEX IF NOT EXISTS idx_job_applicants_token ON public.job_applicants(interview_token);

CREATE TABLE IF NOT EXISTS public.interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_fr TEXT NOT NULL,
  question_en TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'presentation','motivation','experience','sales','availability','scenario','values','closing'
  )),
  order_index INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  weight INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.interview_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID REFERENCES public.job_applicants(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.interview_questions(id),
  answer_text TEXT,
  ai_score INTEGER CHECK (ai_score BETWEEN 0 AND 10),
  ai_feedback TEXT,
  answered_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_interview_answers_applicant ON public.interview_answers(applicant_id);

CREATE TABLE IF NOT EXISTS public.applicant_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID REFERENCES public.job_applicants(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,
  subject TEXT,
  sent_to TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'sent',
  resend_email_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_applicant_emails_applicant ON public.applicant_emails(applicant_id);

CREATE OR REPLACE FUNCTION public.tg_job_applicants_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_job_applicants_updated_at ON public.job_applicants;
CREATE TRIGGER trg_job_applicants_updated_at
  BEFORE UPDATE ON public.job_applicants
  FOR EACH ROW EXECUTE FUNCTION public.tg_job_applicants_updated_at();

ALTER TABLE public.job_applicants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_answers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_emails    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_applicants_admin_all" ON public.job_applicants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'));

CREATE POLICY "interview_questions_admin_all" ON public.interview_questions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'));

CREATE POLICY "interview_answers_admin_all" ON public.interview_answers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'));

CREATE POLICY "applicant_emails_admin_all" ON public.applicant_emails
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'));

CREATE POLICY "interview_questions_public_read_active" ON public.interview_questions
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE OR REPLACE FUNCTION public.get_applicant_by_token(_token uuid)
RETURNS TABLE (
  id uuid, first_name text, last_name text, email text,
  interview_language text, status text,
  interview_started_at timestamptz, interview_completed_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id, first_name, last_name, email, interview_language, status,
         interview_started_at, interview_completed_at
  FROM public.job_applicants
  WHERE interview_token = _token
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_applicant_by_token(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.mark_interview_started(_token uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.job_applicants
  SET interview_started_at = COALESCE(interview_started_at, now()),
      status = CASE WHEN status='invited' THEN 'interview_pending' ELSE status END
  WHERE interview_token = _token
    AND interview_completed_at IS NULL;
END $$;
GRANT EXECUTE ON FUNCTION public.mark_interview_started(uuid) TO anon, authenticated;
