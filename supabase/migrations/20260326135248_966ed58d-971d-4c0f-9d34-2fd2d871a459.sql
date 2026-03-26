
-- Table for CSV import audit trail
CREATE TABLE public.csv_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_by uuid NOT NULL,
  file_name text NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  imported_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  invalid_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  details jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.csv_import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage csv_import_logs"
  ON public.csv_import_logs
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
