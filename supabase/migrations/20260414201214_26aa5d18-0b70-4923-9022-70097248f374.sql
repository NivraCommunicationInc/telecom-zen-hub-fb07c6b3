
-- =============================================
-- FIX #1: Ledger tables — replace raw_user_meta_data with has_role()
-- =============================================

DROP POLICY IF EXISTS "Admins can read all ledger entries" ON public.ledger_entries;
DROP POLICY IF EXISTS "Admins can read all allocations" ON public.ledger_invoice_allocations;

CREATE POLICY "Admins can read all ledger entries"
ON public.ledger_entries
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can read all allocations"
ON public.ledger_invoice_allocations
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- FIX #2: id-documents bucket — admin read access
-- =============================================

CREATE POLICY "Admins can read all ID documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'id-documents'
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- =============================================
-- FIX #3: equipment_audit_log — immutability trigger
-- =============================================

CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'equipment_audit_log is immutable — updates and deletes are forbidden';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_mutation ON public.equipment_audit_log;
CREATE TRIGGER trg_prevent_audit_mutation
  BEFORE UPDATE OR DELETE ON public.equipment_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_mutation();
