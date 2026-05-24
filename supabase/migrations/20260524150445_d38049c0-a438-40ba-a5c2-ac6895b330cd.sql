
-- 1) Per-record salt for client login PINs
ALTER TABLE public.client_login_pins ADD COLUMN IF NOT EXISTS pin_salt text;

-- Invalidate any outstanding PINs hashed under the old global-salt SHA-256 scheme
UPDATE public.client_login_pins SET used = true WHERE used = false;

-- 2) Drop anon SELECT on field_submissions (PII leak)
DROP POLICY IF EXISTS "public_select_submissions" ON public.field_submissions;

-- 3) Tighten complaint-attachments storage bucket upload policy
DROP POLICY IF EXISTS "complaint_attachments_upload" ON storage.objects;
CREATE POLICY "complaint_attachments_upload_staff"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'complaint-attachments'
  AND public.is_internal_staff(auth.uid())
);

-- 4) Restrict crm_agent_status SELECT to internal staff
DROP POLICY IF EXISTS "Agents read all statuses" ON public.crm_agent_status;
CREATE POLICY "Internal staff read agent statuses"
ON public.crm_agent_status
FOR SELECT
TO authenticated
USING (public.is_internal_staff(auth.uid()));

-- 5) Restrict internal content tables to internal staff
DROP POLICY IF EXISTS "Authenticated can read active sops" ON public.sop_documents;
CREATE POLICY "Internal staff read active sops"
ON public.sop_documents
FOR SELECT
TO authenticated
USING (is_active = true AND public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "p_questions_read" ON public.training_questions;
CREATE POLICY "Internal staff read training questions"
ON public.training_questions
FOR SELECT
TO authenticated
USING (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "crm_scripts_select_authenticated" ON public.crm_scripts;
CREATE POLICY "Internal staff read crm scripts"
ON public.crm_scripts
FOR SELECT
TO authenticated
USING (public.is_internal_staff(auth.uid()));

-- 6) Fix search_path on tech_can_access_order
CREATE OR REPLACE FUNCTION public.tech_can_access_order(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'employee')
      OR public.has_role(auth.uid(), 'supervisor')
      OR public.has_role(auth.uid(), 'techops')
      OR EXISTS (
        SELECT 1
        FROM public.technician_assignments ta
        JOIN public.technicians t ON t.id = ta.technician_id
        WHERE ta.order_id = p_order_id
          AND t.user_id = auth.uid()
      )
    );
$function$;
