-- ============================================================
-- FIX #1: Documents storage bucket — remove public read
-- ============================================================
DROP POLICY IF EXISTS "Public read access for documents" ON storage.objects;

-- Clients can only read their own documents (folder = user_id)
CREATE POLICY "clients_own_documents_read"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Staff can read all documents
CREATE POLICY "staff_read_all_documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "employee_read_all_documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND public.has_role(auth.uid(), 'employee')
);

-- ============================================================
-- FIX #2: Identity verification events — admin only
-- ============================================================
DROP POLICY IF EXISTS "Admins can read all events" ON public.identity_verification_events;

CREATE POLICY "Admins can read all events"
ON public.identity_verification_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- FIX #3: Equipment audit log — restrict to staff
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage equipment audit" ON public.equipment_audit_log;

-- Admin/employee can read
CREATE POLICY "Staff can read equipment audit"
ON public.equipment_audit_log
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'employee')
);

-- Admin/employee can insert
CREATE POLICY "Staff can insert equipment audit"
ON public.equipment_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'employee')
);

-- ============================================================
-- FIX #4: Debug table — restrict to admin
-- ============================================================
DROP POLICY IF EXISTS "Allow authenticated read" ON public.support_ticket_id_status_debug;

CREATE POLICY "Admin read debug table"
ON public.support_ticket_id_status_debug
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- FIX #5: PDF template config — restrict to staff
-- ============================================================
DROP POLICY IF EXISTS "pdf_template_config_read_policy" ON public.pdf_template_config;

CREATE POLICY "Staff read pdf template config"
ON public.pdf_template_config
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'employee')
);