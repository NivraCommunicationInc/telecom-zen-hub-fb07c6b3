
CREATE TABLE public.privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  account_id uuid NULL,
  request_type text NOT NULL CHECK (request_type IN ('access','rectification','deletion','portability','withdrawal_consent','complaint')),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','in_review','awaiting_client','completed','refused','cancelled')),
  description text NOT NULL,
  refusal_reason text NULL,
  internal_notes text NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  completed_at timestamptz NULL,
  created_by uuid NULL,
  created_by_email text NULL,
  last_updated_by uuid NULL,
  last_updated_by_email text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_privacy_requests_client ON public.privacy_requests(client_id);
CREATE INDEX idx_privacy_requests_status ON public.privacy_requests(status);
CREATE INDEX idx_privacy_requests_due ON public.privacy_requests(due_at) WHERE status NOT IN ('completed','refused','cancelled');

ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view privacy requests"
ON public.privacy_requests FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
  OR public.has_role(auth.uid(), 'supervisor'::app_role)
  OR public.has_role(auth.uid(), 'support'::app_role)
);

CREATE POLICY "Staff can create privacy requests"
ON public.privacy_requests FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
  OR public.has_role(auth.uid(), 'supervisor'::app_role)
  OR public.has_role(auth.uid(), 'support'::app_role)
);

CREATE POLICY "Staff can update privacy requests"
ON public.privacy_requests FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'employee'::app_role)
  OR public.has_role(auth.uid(), 'supervisor'::app_role)
  OR public.has_role(auth.uid(), 'support'::app_role)
);

CREATE TRIGGER trg_privacy_requests_updated_at
BEFORE UPDATE ON public.privacy_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
