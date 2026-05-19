
-- ============= TABLE =============
CREATE TABLE IF NOT EXISTS public.employee_onboarding_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID REFERENCES public.job_applicants(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  token_expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','reviewed','archived')),
  full_legal_name TEXT,
  date_of_birth DATE,
  phone TEXT,
  email TEXT,
  address_street TEXT,
  address_city TEXT,
  address_province TEXT,
  address_postal TEXT,
  residential_status TEXT CHECK (residential_status IN ('citizen','permanent_resident','work_permit','study_permit','other')),
  residential_status_other TEXT,
  id_document_path TEXT,
  id_document_type TEXT CHECK (id_document_type IN ('passport','drivers_license','other')),
  work_permit_path TEXT,
  void_cheque_path TEXT,
  bank_account_name TEXT,
  signature_data TEXT,
  signature_ip TEXT,
  signed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(user_id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eof_applicant ON public.employee_onboarding_forms(applicant_id);
CREATE INDEX IF NOT EXISTS idx_eof_token ON public.employee_onboarding_forms(token);
CREATE INDEX IF NOT EXISTS idx_eof_status ON public.employee_onboarding_forms(status);

ALTER TABLE public.employee_onboarding_forms ENABLE ROW LEVEL SECURITY;

-- update trigger
DROP TRIGGER IF EXISTS trg_eof_updated_at ON public.employee_onboarding_forms;
CREATE TRIGGER trg_eof_updated_at
BEFORE UPDATE ON public.employee_onboarding_forms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS — admin + HR (supervisor) full access
DROP POLICY IF EXISTS "Admin HR can manage all onboarding forms" ON public.employee_onboarding_forms;
CREATE POLICY "Admin HR can manage all onboarding forms"
ON public.employee_onboarding_forms
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));

-- Public lookup by token is performed via a SECURITY DEFINER RPC instead of RLS on anon,
-- which avoids exposing the table to anonymous selects.
CREATE OR REPLACE FUNCTION public.get_onboarding_form_by_token(p_token UUID)
RETURNS TABLE (
  id UUID,
  applicant_id UUID,
  token UUID,
  token_expires_at TIMESTAMPTZ,
  status TEXT,
  full_legal_name TEXT,
  date_of_birth DATE,
  phone TEXT,
  email TEXT,
  address_street TEXT,
  address_city TEXT,
  address_province TEXT,
  address_postal TEXT,
  residential_status TEXT,
  residential_status_other TEXT,
  id_document_path TEXT,
  id_document_type TEXT,
  work_permit_path TEXT,
  void_cheque_path TEXT,
  bank_account_name TEXT,
  signed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  applicant_first_name TEXT,
  applicant_last_name TEXT,
  applicant_email TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id, f.applicant_id, f.token, f.token_expires_at, f.status,
    f.full_legal_name, f.date_of_birth, f.phone, f.email,
    f.address_street, f.address_city, f.address_province, f.address_postal,
    f.residential_status, f.residential_status_other,
    f.id_document_path, f.id_document_type, f.work_permit_path, f.void_cheque_path,
    f.bank_account_name, f.signed_at, f.submitted_at,
    a.first_name, a.last_name, a.email
  FROM public.employee_onboarding_forms f
  LEFT JOIN public.job_applicants a ON a.id = f.applicant_id
  WHERE f.token = p_token
$$;
GRANT EXECUTE ON FUNCTION public.get_onboarding_form_by_token(UUID) TO anon, authenticated;

-- ============= STORAGE BUCKET =============
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('employee-documents', 'employee-documents', false, 10485760,
  ARRAY['image/jpeg','image/png','application/pdf'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg','image/png','application/pdf'];

-- Storage policies — admin/HR can read/list, nobody else
DROP POLICY IF EXISTS "Admin HR can read employee documents" ON storage.objects;
CREATE POLICY "Admin HR can read employee documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'))
);

DROP POLICY IF EXISTS "Admin HR can manage employee documents" ON storage.objects;
CREATE POLICY "Admin HR can manage employee documents"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'))
)
WITH CHECK (
  bucket_id = 'employee-documents'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'))
);
