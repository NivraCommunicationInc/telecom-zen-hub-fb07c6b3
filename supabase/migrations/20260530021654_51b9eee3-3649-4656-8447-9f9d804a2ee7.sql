
CREATE TABLE IF NOT EXISTS public.client_checkups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_by UUID,
  equipment_ok BOOLEAN,
  service_ok BOOLEAN,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_checkups_account_id ON public.client_checkups(account_id);
CREATE INDEX IF NOT EXISTS idx_client_checkups_checked_at ON public.client_checkups(checked_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_checkups TO authenticated;
GRANT ALL ON public.client_checkups TO service_role;

ALTER TABLE public.client_checkups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view client_checkups"
  ON public.client_checkups FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
    OR public.has_role(auth.uid(), 'supervisor')
  );

CREATE POLICY "Staff can insert client_checkups"
  ON public.client_checkups FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
    OR public.has_role(auth.uid(), 'supervisor')
  );

CREATE POLICY "Staff can update client_checkups"
  ON public.client_checkups FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
  );
