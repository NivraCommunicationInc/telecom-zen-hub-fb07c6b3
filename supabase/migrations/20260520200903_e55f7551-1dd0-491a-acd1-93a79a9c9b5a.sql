
-- Sequence for ticket numbering
CREATE SEQUENCE IF NOT EXISTS public.complaints_seq START 1;

-- complaints table
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL
    DEFAULT 'NVR-' || to_char(now(), 'YYYY') || '-' || LPAD(nextval('public.complaints_seq')::TEXT, 5, '0'),
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  submitted_by_user_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  submitted_by_name TEXT,
  submitted_by_email TEXT NOT NULL,
  submitted_by_phone TEXT,
  category TEXT NOT NULL CHECK (category IN ('technique','facturation','service_client','installation','equipement','resiliation','autre')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent','high','normal','low')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','waiting_client','resolved','closed','escalated')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  assigned_to UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ,
  escalated_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  sla_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON public.complaints(priority);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_to ON public.complaints(assigned_to);
CREATE INDEX IF NOT EXISTS idx_complaints_account_id ON public.complaints(account_id);
CREATE INDEX IF NOT EXISTS idx_complaints_submitted_by ON public.complaints(submitted_by_user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_email ON public.complaints(submitted_by_email);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON public.complaints(created_at DESC);

-- responses
CREATE TABLE IF NOT EXISTS public.complaint_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  response_text TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_complaint_responses_complaint_id ON public.complaint_responses(complaint_id);

-- attachments
CREATE TABLE IF NOT EXISTS public.complaint_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_complaint_attachments_complaint_id ON public.complaint_attachments(complaint_id);

-- SLA trigger
CREATE OR REPLACE FUNCTION public.fn_set_complaint_sla()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.sla_deadline := CASE NEW.priority
    WHEN 'urgent' THEN now() + INTERVAL '4 hours'
    WHEN 'high' THEN now() + INTERVAL '24 hours'
    WHEN 'normal' THEN now() + INTERVAL '72 hours'
    WHEN 'low' THEN now() + INTERVAL '168 hours'
    ELSE now() + INTERVAL '72 hours'
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_complaint_sla ON public.complaints;
CREATE TRIGGER trg_complaint_sla
BEFORE INSERT ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.fn_set_complaint_sla();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.fn_complaints_touch_updated()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_complaints_touch ON public.complaints;
CREATE TRIGGER trg_complaints_touch
BEFORE UPDATE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.fn_complaints_touch_updated();

-- RLS
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_attachments ENABLE ROW LEVEL SECURITY;

-- helper: is staff (admin, employee, field_sales)
CREATE OR REPLACE FUNCTION public.is_complaint_staff(_uid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid,'admin')
      OR public.has_role(_uid,'employee')
      OR public.has_role(_uid,'field_sales')
$$;

-- complaints policies
DROP POLICY IF EXISTS complaints_admin_all ON public.complaints;
CREATE POLICY complaints_admin_all ON public.complaints FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS complaints_staff_read_assigned ON public.complaints;
CREATE POLICY complaints_staff_read_assigned ON public.complaints FOR SELECT TO authenticated
  USING (public.is_complaint_staff(auth.uid()) AND (assigned_to = auth.uid() OR public.has_role(auth.uid(),'admin')));

DROP POLICY IF EXISTS complaints_staff_update_assigned ON public.complaints;
CREATE POLICY complaints_staff_update_assigned ON public.complaints FOR UPDATE TO authenticated
  USING (public.is_complaint_staff(auth.uid()) AND assigned_to = auth.uid())
  WITH CHECK (public.is_complaint_staff(auth.uid()) AND assigned_to = auth.uid());

DROP POLICY IF EXISTS complaints_client_read_own ON public.complaints;
CREATE POLICY complaints_client_read_own ON public.complaints FOR SELECT TO authenticated
  USING (submitted_by_user_id = auth.uid());

DROP POLICY IF EXISTS complaints_client_insert ON public.complaints;
CREATE POLICY complaints_client_insert ON public.complaints FOR INSERT TO authenticated
  WITH CHECK (submitted_by_user_id = auth.uid() OR submitted_by_user_id IS NULL);

DROP POLICY IF EXISTS complaints_public_insert ON public.complaints;
CREATE POLICY complaints_public_insert ON public.complaints FOR INSERT TO anon
  WITH CHECK (submitted_by_user_id IS NULL);

-- responses policies
DROP POLICY IF EXISTS complaint_responses_admin_all ON public.complaint_responses;
CREATE POLICY complaint_responses_admin_all ON public.complaint_responses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS complaint_responses_staff_read_assigned ON public.complaint_responses;
CREATE POLICY complaint_responses_staff_read_assigned ON public.complaint_responses FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND public.is_complaint_staff(auth.uid()) AND c.assigned_to = auth.uid())
  );

DROP POLICY IF EXISTS complaint_responses_staff_insert ON public.complaint_responses;
CREATE POLICY complaint_responses_staff_insert ON public.complaint_responses FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND public.is_complaint_staff(auth.uid()) AND c.assigned_to = auth.uid())
  );

DROP POLICY IF EXISTS complaint_responses_client_read_own ON public.complaint_responses;
CREATE POLICY complaint_responses_client_read_own ON public.complaint_responses FOR SELECT TO authenticated
  USING (
    is_internal = false AND
    EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND c.submitted_by_user_id = auth.uid())
  );

DROP POLICY IF EXISTS complaint_responses_client_insert ON public.complaint_responses;
CREATE POLICY complaint_responses_client_insert ON public.complaint_responses FOR INSERT TO authenticated
  WITH CHECK (
    is_internal = false AND
    author_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND c.submitted_by_user_id = auth.uid())
  );

-- attachments policies
DROP POLICY IF EXISTS complaint_attachments_admin_all ON public.complaint_attachments;
CREATE POLICY complaint_attachments_admin_all ON public.complaint_attachments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS complaint_attachments_staff_read ON public.complaint_attachments;
CREATE POLICY complaint_attachments_staff_read ON public.complaint_attachments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND public.is_complaint_staff(auth.uid()) AND c.assigned_to = auth.uid())
  );

DROP POLICY IF EXISTS complaint_attachments_client_read ON public.complaint_attachments;
CREATE POLICY complaint_attachments_client_read ON public.complaint_attachments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND c.submitted_by_user_id = auth.uid())
  );

DROP POLICY IF EXISTS complaint_attachments_public_insert ON public.complaint_attachments;
CREATE POLICY complaint_attachments_public_insert ON public.complaint_attachments FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('complaint-attachments', 'complaint-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: anon and authenticated can upload to this bucket
DROP POLICY IF EXISTS "complaint_attachments_upload" ON storage.objects;
CREATE POLICY "complaint_attachments_upload" ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'complaint-attachments');

DROP POLICY IF EXISTS "complaint_attachments_read_staff" ON storage.objects;
CREATE POLICY "complaint_attachments_read_staff" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'complaint-attachments' AND public.is_complaint_staff(auth.uid()));
