-- Add scheduling + admin notes infra for job applications
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS interview_date timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE TABLE IF NOT EXISTS public.job_application_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jan_application ON public.job_application_notes(application_id);

ALTER TABLE public.job_application_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read job_application_notes" ON public.job_application_notes;
CREATE POLICY "Admins read job_application_notes"
  ON public.job_application_notes FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

DROP POLICY IF EXISTS "Admins insert job_application_notes" ON public.job_application_notes;
CREATE POLICY "Admins insert job_application_notes"
  ON public.job_application_notes FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

DROP POLICY IF EXISTS "Admins delete job_application_notes" ON public.job_application_notes;
CREATE POLICY "Admins delete job_application_notes"
  ON public.job_application_notes FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));