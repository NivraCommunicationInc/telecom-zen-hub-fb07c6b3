-- Revert test applicant 906c07a4 marked as completed during diagnostic curl test
UPDATE public.job_applicants
SET status = 'interview_pending',
    interview_completed_at = NULL,
    interview_score = NULL,
    interview_recommendation = NULL,
    interview_notes = NULL,
    interview_strengths = NULL,
    interview_concerns = NULL,
    interview_red_flags = NULL
WHERE id = '906c07a4-b0de-4fbe-beed-0d7aef0cbbd0'
  AND interview_completed_at = '2026-05-22 14:11:53'::timestamptz - INTERVAL '1 minute' -- safety: only if completed in the last minute
  OR (id = '906c07a4-b0de-4fbe-beed-0d7aef0cbbd0' AND interview_score = 0);
DELETE FROM public.interview_answers WHERE applicant_id = '906c07a4-b0de-4fbe-beed-0d7aef0cbbd0';