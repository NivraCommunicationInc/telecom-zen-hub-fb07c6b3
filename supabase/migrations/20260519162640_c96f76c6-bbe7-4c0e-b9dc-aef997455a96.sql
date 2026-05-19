
CREATE TABLE IF NOT EXISTS public.rma_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  client_name TEXT,
  device_type TEXT NOT NULL,
  serial_number TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','approved','shipped','received','replaced','closed')
  ),
  tracking_number TEXT,
  notes TEXT,
  status_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rma_requests_status ON public.rma_requests(status);
CREATE INDEX IF NOT EXISTS idx_rma_requests_account ON public.rma_requests(account_id);
CREATE INDEX IF NOT EXISTS idx_rma_requests_created_at ON public.rma_requests(created_at DESC);

ALTER TABLE public.rma_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rma_admin_all"
  ON public.rma_requests FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "rma_staff_read"
  ON public.rma_requests FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'employee'::app_role)
    OR public.has_role(auth.uid(), 'support'::app_role)
    OR public.has_role(auth.uid(), 'techops'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_role(auth.uid(), 'technician'::app_role)
  );

CREATE POLICY "rma_staff_update"
  ON public.rma_requests FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'employee'::app_role)
    OR public.has_role(auth.uid(), 'support'::app_role)
    OR public.has_role(auth.uid(), 'techops'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
  );

CREATE POLICY "rma_staff_insert"
  ON public.rma_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'employee'::app_role)
    OR public.has_role(auth.uid(), 'support'::app_role)
    OR public.has_role(auth.uid(), 'techops'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
  );

CREATE POLICY "rma_client_read_own"
  ON public.rma_requests FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT a.id FROM public.accounts a
      JOIN public.profiles p ON p.id = a.client_id
      WHERE p.user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS trg_rma_requests_updated_at ON public.rma_requests;
CREATE TRIGGER trg_rma_requests_updated_at
BEFORE UPDATE ON public.rma_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
