-- ═══ EQUIPMENT RETURN REQUESTS (RMA) ═══

CREATE TABLE IF NOT EXISTS public.equipment_return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  equipment_inventory_id UUID,
  client_user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  reason_detail TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  return_label_url TEXT,
  tracking_number TEXT,
  carrier TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  equipment_condition TEXT,
  refund_amount NUMERIC(10,2),
  refund_processed_at TIMESTAMPTZ,
  agent_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT equipment_return_requests_status_check
    CHECK (status IN ('pending','approved','label_sent','shipped','received','completed','rejected'))
);

CREATE INDEX IF NOT EXISTS idx_equipment_return_requests_account ON public.equipment_return_requests(account_id);
CREATE INDEX IF NOT EXISTS idx_equipment_return_requests_client  ON public.equipment_return_requests(client_user_id);
CREATE INDEX IF NOT EXISTS idx_equipment_return_requests_status  ON public.equipment_return_requests(status);
CREATE INDEX IF NOT EXISTS idx_equipment_return_requests_requested_at ON public.equipment_return_requests(requested_at DESC);

ALTER TABLE public.equipment_return_requests ENABLE ROW LEVEL SECURITY;

-- Clients: can insert and view their own
CREATE POLICY "Clients can create their own return requests"
  ON public.equipment_return_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = client_user_id);

CREATE POLICY "Clients can view their own return requests"
  ON public.equipment_return_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = client_user_id);

-- Staff: full access
CREATE POLICY "Staff can view all return requests"
  ON public.equipment_return_requests
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
    OR public.has_role(auth.uid(), 'billing_admin')
    OR public.has_role(auth.uid(), 'employee')
    OR public.has_role(auth.uid(), 'field_sales')
  );

CREATE POLICY "Staff can update all return requests"
  ON public.equipment_return_requests
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
    OR public.has_role(auth.uid(), 'billing_admin')
    OR public.has_role(auth.uid(), 'employee')
    OR public.has_role(auth.uid(), 'field_sales')
  );

CREATE POLICY "Staff can insert return requests"
  ON public.equipment_return_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
    OR public.has_role(auth.uid(), 'billing_admin')
    OR public.has_role(auth.uid(), 'employee')
  );

-- Service role (Edge Functions / cron)
CREATE POLICY "Service role full access on equipment_return_requests"
  ON public.equipment_return_requests
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- updated_at trigger using existing helper function
DROP TRIGGER IF EXISTS trg_equipment_return_requests_updated_at ON public.equipment_return_requests;
CREATE TRIGGER trg_equipment_return_requests_updated_at
  BEFORE UPDATE ON public.equipment_return_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();