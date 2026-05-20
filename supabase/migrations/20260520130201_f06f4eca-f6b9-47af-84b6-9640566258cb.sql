ALTER TABLE public.employee_onboarding_forms REPLICA IDENTITY FULL;
ALTER TABLE public.job_applicants REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_onboarding_forms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_applicants;