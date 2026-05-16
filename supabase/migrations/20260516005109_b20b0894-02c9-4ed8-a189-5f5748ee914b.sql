
ALTER TABLE public.field_commissions DROP CONSTRAINT IF EXISTS field_commissions_status_check;
ALTER TABLE public.field_commissions
  ADD CONSTRAINT field_commissions_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'paid'::text, 'clawback'::text, 'on_hold'::text, 'disputed'::text]));

CREATE TABLE IF NOT EXISTS public.payroll_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  pay_date date NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  commissions_amount numeric(12,2) NOT NULL DEFAULT 0,
  bonus_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  commission_ids uuid[] NOT NULL DEFAULT '{}',
  is_last_friday_of_month boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'paid',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_records_agent_date
  ON public.payroll_records (agent_id, pay_date DESC);

ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents read own payroll" ON public.payroll_records;
CREATE POLICY "Agents read own payroll"
  ON public.payroll_records FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage payroll" ON public.payroll_records;
CREATE POLICY "Admins manage payroll"
  ON public.payroll_records FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
