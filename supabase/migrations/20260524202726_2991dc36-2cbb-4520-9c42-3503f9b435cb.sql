CREATE TABLE IF NOT EXISTS public.account_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id UUID NOT NULL,
  account_id UUID,
  tag_key TEXT NOT NULL,
  tag_label TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  note TEXT,
  created_by UUID,
  created_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  CONSTRAINT account_tags_unique_active UNIQUE (client_user_id, tag_key)
);

CREATE INDEX IF NOT EXISTS account_tags_client_idx ON public.account_tags(client_user_id);
CREATE INDEX IF NOT EXISTS account_tags_account_idx ON public.account_tags(account_id);
CREATE INDEX IF NOT EXISTS account_tags_severity_idx ON public.account_tags(severity);

ALTER TABLE public.account_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view account_tags"
  ON public.account_tags FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'support'::app_role)
    OR public.has_role(auth.uid(), 'billing_admin'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_role(auth.uid(), 'employee'::app_role)
  );

CREATE POLICY "Staff can insert account_tags"
  ON public.account_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'support'::app_role)
    OR public.has_role(auth.uid(), 'billing_admin'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
  );

CREATE POLICY "Staff can delete account_tags"
  ON public.account_tags FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'support'::app_role)
    OR public.has_role(auth.uid(), 'billing_admin'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
  );

CREATE POLICY "Deny anon access to account_tags"
  ON public.account_tags FOR ALL
  TO anon
  USING (false);