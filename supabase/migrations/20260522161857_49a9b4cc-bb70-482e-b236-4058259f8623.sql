-- Allow anonymous candidates to submit interview data
CREATE POLICY "job_applicants_anon_insert"
  ON public.job_applicants FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "applicant_emails_anon_insert"
  ON public.applicant_emails FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "interview_answers_anon_insert"
  ON public.interview_answers FOR INSERT
  TO anon
  WITH CHECK (true);