CREATE TABLE IF NOT EXISTS public.service_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  current_plan_name text,
  requested_plan_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  requested_plan_name text NOT NULL,
  change_type text NOT NULL DEFAULT 'change_plan',
  status text NOT NULL DEFAULT 'pending_core',
  notes text,
  requested_by uuid NOT NULL,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.suspension_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  reason text NOT NULL,
  requested_for date,
  status text NOT NULL DEFAULT 'pending_core',
  notes text,
  requested_by uuid NOT NULL,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kyc_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  requested_id_type text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  requested_by uuid NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS assigned_department text,
  ADD COLUMN IF NOT EXISTS service_address text,
  ADD COLUMN IF NOT EXISTS equipment_serial text;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

ALTER TABLE public.service_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suspension_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_service_change_requests_account ON public.service_change_requests(account_id);
CREATE INDEX IF NOT EXISTS idx_service_change_requests_status ON public.service_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_suspension_requests_account ON public.suspension_requests(account_id);
CREATE INDEX IF NOT EXISTS idx_suspension_requests_status ON public.suspension_requests(status);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_client ON public.kyc_verifications(client_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_status ON public.kyc_verifications(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_department ON public.support_tickets(assigned_department);

DROP POLICY IF EXISTS "Staff can view service change requests" ON public.service_change_requests;
CREATE POLICY "Staff can view service change requests"
ON public.service_change_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'employee'));

DROP POLICY IF EXISTS "Staff can create service change requests" ON public.service_change_requests;
CREATE POLICY "Staff can create service change requests"
ON public.service_change_requests FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'employee'));

DROP POLICY IF EXISTS "Admins can update service change requests" ON public.service_change_requests;
CREATE POLICY "Admins can update service change requests"
ON public.service_change_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));

DROP POLICY IF EXISTS "Staff can view suspension requests" ON public.suspension_requests;
CREATE POLICY "Staff can view suspension requests"
ON public.suspension_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'employee'));

DROP POLICY IF EXISTS "Staff can create suspension requests" ON public.suspension_requests;
CREATE POLICY "Staff can create suspension requests"
ON public.suspension_requests FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'employee'));

DROP POLICY IF EXISTS "Admins can update suspension requests" ON public.suspension_requests;
CREATE POLICY "Admins can update suspension requests"
ON public.suspension_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));

DROP POLICY IF EXISTS "Staff can view kyc verifications" ON public.kyc_verifications;
CREATE POLICY "Staff can view kyc verifications"
ON public.kyc_verifications FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'employee'));

DROP POLICY IF EXISTS "Clients can view their kyc verifications" ON public.kyc_verifications;
CREATE POLICY "Clients can view their kyc verifications"
ON public.kyc_verifications FOR SELECT TO authenticated
USING (auth.uid() = client_id);

DROP POLICY IF EXISTS "Staff can create kyc verifications" ON public.kyc_verifications;
CREATE POLICY "Staff can create kyc verifications"
ON public.kyc_verifications FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'employee'));

DROP POLICY IF EXISTS "Staff can update kyc verifications" ON public.kyc_verifications;
CREATE POLICY "Staff can update kyc verifications"
ON public.kyc_verifications FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'employee'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'employee'));

DROP TRIGGER IF EXISTS update_service_change_requests_updated_at ON public.service_change_requests;
CREATE TRIGGER update_service_change_requests_updated_at
BEFORE UPDATE ON public.service_change_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_suspension_requests_updated_at ON public.suspension_requests;
CREATE TRIGGER update_suspension_requests_updated_at
BEFORE UPDATE ON public.suspension_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_kyc_verifications_updated_at ON public.kyc_verifications;
CREATE TRIGGER update_kyc_verifications_updated_at
BEFORE UPDATE ON public.kyc_verifications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();