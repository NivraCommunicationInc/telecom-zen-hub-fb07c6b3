
-- Collections / dunning action log
CREATE TABLE IF NOT EXISTS public.collections_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  action_type text NOT NULL CHECK (action_type IN (
    'contact_email','contact_phone','contact_sms','payment_plan',
    'promise_to_pay','escalation','writeoff','resolved','note'
  )),
  notes text,
  amount_promised numeric,
  promise_date date,
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collections_actions_invoice ON public.collections_actions(invoice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collections_actions_customer ON public.collections_actions(customer_id, created_at DESC);

ALTER TABLE public.collections_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Collections staff can view actions"
ON public.collections_actions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'billing_admin'::app_role)
  OR public.has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Collections staff can insert actions"
ON public.collections_actions FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'billing_admin'::app_role)
  OR public.has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Admin can update actions"
ON public.collections_actions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete actions"
ON public.collections_actions FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
