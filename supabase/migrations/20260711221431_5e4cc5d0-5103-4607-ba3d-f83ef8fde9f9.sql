
CREATE TABLE public.phone_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_phone text,
  new_phone text NOT NULL,
  otp_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','expired','cancelled','failed')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  verified_at timestamptz,
  requested_by uuid,
  requested_by_role text,
  reason text,
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_phone_change_client ON public.phone_change_requests(client_id);
CREATE INDEX idx_phone_change_status ON public.phone_change_requests(status);
CREATE INDEX idx_phone_change_expires ON public.phone_change_requests(expires_at);

GRANT SELECT ON public.phone_change_requests TO authenticated;
GRANT ALL ON public.phone_change_requests TO service_role;

ALTER TABLE public.phone_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own phone change requests"
  ON public.phone_change_requests FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "Staff can view phone change requests"
  ON public.phone_change_requests FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_role(auth.uid(), 'support'::app_role)
  );

CREATE TRIGGER trg_phone_change_requests_updated_at
BEFORE UPDATE ON public.phone_change_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
