DELETE FROM public.applicant_emails
WHERE applicant_id = '906c07a4-b0de-4fbe-beed-0d7aef0cbbd0'
  AND email_type = 'interview_completed_admin';

DELETE FROM public.interview_answers
WHERE applicant_id = '906c07a4-b0de-4fbe-beed-0d7aef0cbbd0';

UPDATE public.job_applicants
SET status = 'interview_pending',
    interview_completed_at = NULL,
    interview_started_at = NULL,
    interview_score = NULL,
    interview_recommendation = NULL,
    interview_notes = NULL,
    interview_strengths = NULL,
    interview_concerns = NULL,
    interview_red_flags = NULL
WHERE id = '906c07a4-b0de-4fbe-beed-0d7aef0cbbd0';

DELETE FROM public.email_queue
WHERE event_key = 'interview_done_906c07a4-b0de-4fbe-beed-0d7aef0cbbd0';