
-- Add pdf_url column to payroll_entries
ALTER TABLE public.payroll_entries ADD COLUMN IF NOT EXISTS pdf_url text;
ALTER TABLE public.payroll_entries ADD COLUMN IF NOT EXISTS payroll_number text;

-- Create storage bucket for payslips
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payslips', 'payslips', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- RLS on storage: admin can do everything, employees can read their own
CREATE POLICY "Admin full access to payslips" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'payslips' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'payslips' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees read own payslips" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payslips' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
