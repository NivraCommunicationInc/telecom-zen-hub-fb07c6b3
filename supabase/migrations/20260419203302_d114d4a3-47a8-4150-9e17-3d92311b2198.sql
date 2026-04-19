-- ========================================
-- HR REBUILD — Consolidated migration (Phases 3, 5, 6, 7, 8)
-- ========================================

-- ----------------------------------------
-- PHASE 3 — Commission rules table
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Either employee_id OR role must be set (rule applies to one specific employee or to a whole role)
  employee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT,
  -- Product scope: internet, mobile, tv, bundle, phone, all
  applies_to TEXT NOT NULL DEFAULT 'all'
    CHECK (applies_to IN ('internet','mobile','tv','bundle','phone','all')),
  -- Commission percentage (0-100)
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  min_monthly NUMERIC(10,2),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (employee_id IS NOT NULL OR role IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_commission_rules_employee ON public.commission_rules(employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commission_rules_role ON public.commission_rules(role) WHERE role IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commission_rules_active ON public.commission_rules(is_active, effective_from);

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage commission rules"
  ON public.commission_rules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees view own commission rules"
  ON public.commission_rules FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

CREATE TRIGGER set_commission_rules_updated_at
  BEFORE UPDATE ON public.commission_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------
-- PHASE 3 — Unified commissions VIEW
-- ----------------------------------------
CREATE OR REPLACE VIEW public.unified_commissions AS
SELECT
  id,
  salesperson_id AS employee_id,
  'sales'::text AS source,
  commission_amount AS amount,
  sale_amount,
  commission_rate,
  status,
  notes,
  created_at,
  updated_at,
  COALESCE(converted_order_id::text, field_order_id::text) AS reference_id,
  validated_at,
  paid_at
FROM public.sales_commissions
UNION ALL
SELECT
  id,
  agent_id AS employee_id,
  'field'::text AS source,
  amount,
  NULL::numeric AS sale_amount,
  NULL::numeric AS commission_rate,
  status,
  notes,
  created_at,
  updated_at,
  COALESCE(order_id::text, lead_id::text) AS reference_id,
  approved_at AS validated_at,
  paid_at
FROM public.field_commissions;

GRANT SELECT ON public.unified_commissions TO authenticated;

-- ----------------------------------------
-- PHASE 5 — Add location to time_entries
-- ----------------------------------------
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS punch_in_lat NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS punch_in_lng NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS punch_out_lat NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS punch_out_lng NUMERIC(10,7);

-- Add policy for staff to insert their own time entries
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='time_entries' AND policyname='Staff insert own time') THEN
    CREATE POLICY "Staff insert own time"
      ON public.time_entries FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='time_entries' AND policyname='Staff update own active time') THEN
    CREATE POLICY "Staff update own active time"
      ON public.time_entries FOR UPDATE TO authenticated
      USING (user_id = auth.uid() AND punch_out IS NULL)
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ----------------------------------------
-- PHASE 6 — HR requests table (leave/vacation/absence)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL
    CHECK (request_type IN ('vacation','sick_leave','personal_leave','part_time','other')),
  start_date DATE NOT NULL,
  end_date DATE,
  hours_requested NUMERIC(5,2),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','declined','cancelled')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_requests_employee ON public.hr_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_requests_status ON public.hr_requests(status);
CREATE INDEX IF NOT EXISTS idx_hr_requests_dates ON public.hr_requests(start_date, end_date);

ALTER TABLE public.hr_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees manage own requests"
  ON public.hr_requests FOR ALL TO authenticated
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Admins manage all hr_requests"
  ON public.hr_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_hr_requests_updated_at
  BEFORE UPDATE ON public.hr_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------
-- PHASE 7 — HR documents table + storage bucket
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id),
  document_type TEXT NOT NULL
    CHECK (document_type IN ('medical_certificate','absence_justification','requested_by_hr','signed_form','other')),
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','approved','rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_documents_employee ON public.hr_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_documents_status ON public.hr_documents(status);

ALTER TABLE public.hr_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees view own hr_documents"
  ON public.hr_documents FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

CREATE POLICY "Employees insert own hr_documents"
  ON public.hr_documents FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Admins manage all hr_documents"
  ON public.hr_documents FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_hr_documents_updated_at
  BEFORE UPDATE ON public.hr_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('hr-documents', 'hr-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies — files keyed by employee_id/<filename>
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Employees upload to own hr-documents folder') THEN
    CREATE POLICY "Employees upload to own hr-documents folder"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'hr-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Employees read own hr-documents') THEN
    CREATE POLICY "Employees read own hr-documents"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'hr-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admins manage all hr-documents') THEN
    CREATE POLICY "Admins manage all hr-documents"
      ON storage.objects FOR ALL TO authenticated
      USING (bucket_id = 'hr-documents' AND has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (bucket_id = 'hr-documents' AND has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- ----------------------------------------
-- PHASE 8 — Extend existing jobs table
-- ----------------------------------------
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS salary_min NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS salary_max NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS expires_at DATE,
  ADD COLUMN IF NOT EXISTS posted_by UUID REFERENCES auth.users(id);

-- Extend job_applications for pipeline stages
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'new'
    CHECK (stage IN ('new','reviewing','interview','offer','hired','rejected')),
  ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS stage_changed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS hired_employee_id UUID REFERENCES public.employee_records(id);

-- ----------------------------------------
-- Notifications helper for HR events
-- ----------------------------------------
-- Trigger: when an hr_request is created → notify HR admins (placeholder; uses employee_notifications table if applicable to admin)
-- Skipped: notifications are dispatched from app code via supabase.functions.invoke for emails.