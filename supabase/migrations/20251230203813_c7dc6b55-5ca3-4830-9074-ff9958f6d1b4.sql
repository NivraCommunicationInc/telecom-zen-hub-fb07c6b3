-- Job applications table
CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  job_id UUID NULL REFERENCES public.jobs(id) ON DELETE SET NULL,
  position TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT NULL,
  cv_path TEXT NULL,
  cv_filename TEXT NULL,
  status TEXT NOT NULL DEFAULT 'new'
);

CREATE INDEX IF NOT EXISTS idx_job_applications_created_at ON public.job_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON public.job_applications(status);

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Public can submit applications (no read)
DO $$ BEGIN
  CREATE POLICY "Anyone can create job applications"
  ON public.job_applications
  FOR INSERT
  WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Admin full access
DO $$ BEGIN
  CREATE POLICY "Admins can manage job applications"
  ON public.job_applications
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Storage bucket for CVs (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-applications', 'job-applications', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$ BEGIN
  CREATE POLICY "Admins can read job application files"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'job-applications' AND has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can manage job application files"
  ON storage.objects
  FOR ALL
  USING (bucket_id = 'job-applications' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'job-applications' AND has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can upload job application CV"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'job-applications'
    AND name LIKE 'applications/%'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;