
-- ==========================================================
-- payroll_payments — advanced payment lifecycle table
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.payroll_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number text UNIQUE,
  payroll_entry_id uuid REFERENCES public.payroll_entries(id) ON DELETE CASCADE,
  employee_user_id uuid NOT NULL,
  employee_name text,
  employee_number text,
  employee_email text,
  gross_amount numeric(12,2) NOT NULL DEFAULT 0,
  net_amount numeric(12,2) NOT NULL DEFAULT 0,
  deductions_total numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'interac',
  payment_status text NOT NULL DEFAULT 'draft',
  scheduled_date date,
  sent_date timestamptz,
  confirmed_date timestamptz,
  bounced_date timestamptz,
  bank_reference text,
  confirmation_number text,
  transaction_id text,
  recipient_account_last4 text,
  recipient_bank_name text,
  failure_reason text,
  failure_code text,
  retry_count int NOT NULL DEFAULT 0,
  pdf_avis_url text,
  pdf_paystub_url text,
  email_sent_at timestamptz,
  email_opened_at timestamptz,
  email_bounced_at timestamptz,
  internal_notes text,
  client_visible_notes text,
  requires_approval boolean NOT NULL DEFAULT false,
  approval_threshold_amount numeric(12,2),
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_by_name text,
  approved_by uuid,
  approved_by_name text,
  approved_at timestamptz,
  sent_by uuid,
  sent_by_name text,
  confirmed_by uuid,
  confirmed_by_name text,
  cancelled_by uuid,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_payments_method_chk CHECK (payment_method IN ('interac','direct_deposit','cheque','cash','wire_transfer','paypal','other')),
  CONSTRAINT payroll_payments_status_chk CHECK (payment_status IN ('draft','scheduled','pending_approval','approved','processing','sent','confirmed','failed','bounced','cancelled','reversed','disputed','on_hold'))
);

CREATE INDEX IF NOT EXISTS idx_payroll_payments_status ON public.payroll_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_payroll_payments_employee ON public.payroll_payments(employee_user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_payments_scheduled ON public.payroll_payments(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_payroll_payments_entry ON public.payroll_payments(payroll_entry_id);
CREATE INDEX IF NOT EXISTS idx_payroll_payments_created ON public.payroll_payments(created_at DESC);

-- Auto payment_number generator
CREATE OR REPLACE FUNCTION public.gen_payroll_payment_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_date text;
BEGIN
  IF NEW.payment_number IS NOT NULL THEN RETURN NEW; END IF;
  v_date := to_char(now(), 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO v_count FROM public.payroll_payments
    WHERE payment_number LIKE 'PAY-' || v_date || '-%';
  NEW.payment_number := 'PAY-' || v_date || '-' || lpad(v_count::text, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payroll_payments_number ON public.payroll_payments;
CREATE TRIGGER trg_payroll_payments_number
BEFORE INSERT ON public.payroll_payments
FOR EACH ROW EXECUTE FUNCTION public.gen_payroll_payment_number();

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_payroll_payments_updated ON public.payroll_payments;
CREATE TRIGGER trg_payroll_payments_updated
BEFORE UPDATE ON public.payroll_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================================
-- payroll_payment_events — timeline / audit trail
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.payroll_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payroll_payments(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  actor_name text,
  actor_role text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_payment_events_payment ON public.payroll_payment_events(payment_id, created_at DESC);

-- ==========================================================
-- RLS
-- ==========================================================
ALTER TABLE public.payroll_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage payroll_payments" ON public.payroll_payments;
CREATE POLICY "Admins manage payroll_payments" ON public.payroll_payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Staff view own payroll_payments" ON public.payroll_payments;
CREATE POLICY "Staff view own payroll_payments" ON public.payroll_payments
  FOR SELECT TO authenticated
  USING (employee_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins view payroll_payment_events" ON public.payroll_payment_events;
CREATE POLICY "Admins view payroll_payment_events" ON public.payroll_payment_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Owners view their payment events" ON public.payroll_payment_events;
CREATE POLICY "Owners view their payment events" ON public.payroll_payment_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.payroll_payments p
    WHERE p.id = payroll_payment_events.payment_id
      AND p.employee_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins insert payroll_payment_events" ON public.payroll_payment_events;
CREATE POLICY "Admins insert payroll_payment_events" ON public.payroll_payment_events
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.payroll_payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payroll_payment_events;
