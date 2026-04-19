-- hr_request_notes: admin-only internal notes on HR requests
CREATE TABLE IF NOT EXISTS public.hr_request_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.hr_requests(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by uuid NOT NULL,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_request_notes_request ON public.hr_request_notes(request_id);

ALTER TABLE public.hr_request_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read hr_request_notes"
  ON public.hr_request_notes FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Admins insert hr_request_notes"
  ON public.hr_request_notes FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Admins update hr_request_notes"
  ON public.hr_request_notes FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Admins delete hr_request_notes"
  ON public.hr_request_notes FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- hr-documents storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('hr-documents', 'hr-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for hr-documents
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='hr_docs_admin_all') THEN
    CREATE POLICY "hr_docs_admin_all"
      ON storage.objects FOR ALL
      TO authenticated
      USING (bucket_id = 'hr-documents' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)))
      WITH CHECK (bucket_id = 'hr-documents' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='hr_docs_employee_read_own') THEN
    CREATE POLICY "hr_docs_employee_read_own"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'hr-documents'
        AND EXISTS (
          SELECT 1 FROM public.hr_requests r
          WHERE r.employee_id = auth.uid()
            AND name LIKE 'requests/' || r.id::text || '/%'
        )
      );
  END IF;
END $$;