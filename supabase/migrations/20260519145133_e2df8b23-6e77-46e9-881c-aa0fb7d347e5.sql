-- Align interview constraints with AI analyzer output

ALTER TABLE public.job_applicants DROP CONSTRAINT IF EXISTS job_applicants_interview_score_check;
ALTER TABLE public.job_applicants ADD CONSTRAINT job_applicants_interview_score_check
  CHECK (interview_score IS NULL OR (interview_score >= 0 AND interview_score <= 100));

ALTER TABLE public.job_applicants DROP CONSTRAINT IF EXISTS job_applicants_interview_recommendation_check;
ALTER TABLE public.job_applicants ADD CONSTRAINT job_applicants_interview_recommendation_check
  CHECK (interview_recommendation IS NULL OR interview_recommendation = ANY (ARRAY['hire','interview_human','reject']));

ALTER TABLE public.job_applicants DROP CONSTRAINT IF EXISTS job_applicants_status_check;
ALTER TABLE public.job_applicants ADD CONSTRAINT job_applicants_status_check
  CHECK (status = ANY (ARRAY['new','invited','interview_started','interview_pending','interview_completed','reviewing','accepted','rejected','hired','no_show','withdrawn','excluded']));

ALTER TABLE public.job_applicants ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE public.job_applicants ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- Allow public token-gated upsert of answers via RLS function path
-- (interview_answers writes happen via service role in edge function, no policy change needed)
