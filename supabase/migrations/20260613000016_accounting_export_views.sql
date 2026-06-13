-- AUDIT FIX FC-1 + RA-4: Accounting export views for QuickBooks/Sage + fiscal compliance
-- Creates views for monthly/annual revenue reporting, TPS/TVQ remittances,
-- QuickBooks-compatible exports, and T4A commission tracking.

-- Monthly revenue summary (for CRA/Revenu Québec TPS/TVQ remittances)
DROP VIEW IF EXISTS public.v_monthly_revenue_summary CASCADE;
CREATE VIEW public.v_monthly_revenue_summary AS
SELECT
  DATE_TRUNC('month', i.created_at)::DATE AS month,
  COUNT(*) FILTER (WHERE i.status IN ('paid','partial')) AS invoices_paid,
  COUNT(*) FILTER (WHERE i.status = 'pending')           AS invoices_pending,
  COUNT(*) FILTER (WHERE i.status IN ('overdue','failed')) AS invoices_overdue,
  COALESCE(SUM(i.subtotal)    FILTER (WHERE i.status IN ('paid','partial')), 0) AS revenue_pre_tax,
  COALESCE(SUM(i.tps_amount)  FILTER (WHERE i.status IN ('paid','partial')), 0) AS tps_collected,
  COALESCE(SUM(i.tvq_amount)  FILTER (WHERE i.status IN ('paid','partial')), 0) AS tvq_collected,
  COALESCE(SUM(i.total)       FILTER (WHERE i.status IN ('paid','partial')), 0) AS revenue_total,
  COALESCE(SUM(i.amount_paid), 0) AS amount_received
FROM public.billing_invoices i
GROUP BY DATE_TRUNC('month', i.created_at)::DATE
ORDER BY month DESC;

-- Annual revenue summary (for T2 corporate income tax)
DROP VIEW IF EXISTS public.v_annual_revenue_summary CASCADE;
CREATE VIEW public.v_annual_revenue_summary AS
SELECT
  EXTRACT(YEAR FROM i.created_at)::INTEGER AS tax_year,
  COUNT(*) FILTER (WHERE i.status IN ('paid','partial'))                        AS invoices_paid,
  COALESCE(SUM(i.subtotal)    FILTER (WHERE i.status IN ('paid','partial')), 0) AS gross_revenue,
  COALESCE(SUM(i.tps_amount)  FILTER (WHERE i.status IN ('paid','partial')), 0) AS tps_collected,
  COALESCE(SUM(i.tvq_amount)  FILTER (WHERE i.status IN ('paid','partial')), 0) AS tvq_collected,
  COALESCE(SUM(i.total)       FILTER (WHERE i.status IN ('paid','partial')), 0) AS gross_invoiced,
  COALESCE(SUM(i.amount_paid), 0)                                                AS total_received,
  COALESCE(SUM(i.balance_due) FILTER (WHERE i.status NOT IN ('paid','cancelled','void')), 0) AS accounts_receivable
FROM public.billing_invoices i
GROUP BY EXTRACT(YEAR FROM i.created_at)::INTEGER
ORDER BY tax_year DESC;

-- Quarterly TPS/TVQ remittance (for CRA and Revenu Québec filings)
DROP VIEW IF EXISTS public.v_tax_remittance_report CASCADE;
CREATE VIEW public.v_tax_remittance_report AS
SELECT
  q.quarter_start,
  (q.quarter_start + INTERVAL '3 months - 1 day')::DATE AS quarter_end,
  COALESCE(SUM(i.tps_amount) FILTER (WHERE i.status IN ('paid','partial')), 0) AS tps_to_remit,
  COALESCE(SUM(i.tvq_amount) FILTER (WHERE i.status IN ('paid','partial')), 0) AS tvq_to_remit,
  COALESCE(SUM(i.tps_amount + i.tvq_amount) FILTER (WHERE i.status IN ('paid','partial')), 0) AS total_taxes,
  COUNT(*) FILTER (WHERE i.status IN ('paid','partial')) AS transactions_count
FROM public.billing_invoices i
CROSS JOIN LATERAL (SELECT DATE_TRUNC('quarter', i.created_at)::DATE AS quarter_start) q
GROUP BY q.quarter_start
ORDER BY q.quarter_start DESC;

-- QuickBooks-compatible invoice export
DROP VIEW IF EXISTS public.v_quickbooks_invoices CASCADE;
CREATE VIEW public.v_quickbooks_invoices AS
SELECT
  i.invoice_number,
  i.created_at::DATE  AS invoice_date,
  i.due_date,
  c.first_name || ' ' || c.last_name AS customer_name,
  c.email             AS customer_email,
  i.subtotal,
  i.tps_amount        AS tps_5pct,
  i.tvq_amount        AS tvq_9975pct,
  i.total,
  i.amount_paid,
  i.balance_due,
  i.status::TEXT      AS invoice_status,
  i.currency,
  i.type::TEXT        AS invoice_type,
  COALESCE(i.payment_method::TEXT, '') AS payment_method
FROM public.billing_invoices i
JOIN public.billing_customers c ON c.id = i.customer_id
ORDER BY i.created_at DESC;

-- QuickBooks-compatible payment export
DROP VIEW IF EXISTS public.v_quickbooks_payments CASCADE;
CREATE VIEW public.v_quickbooks_payments AS
SELECT
  p.id::TEXT          AS payment_id,
  i.invoice_number,
  p.received_at::DATE AS payment_date,
  c.first_name || ' ' || c.last_name AS customer_name,
  p.amount,
  i.currency,
  p.method::TEXT      AS method,
  COALESCE(p.provider, '')              AS provider,
  COALESCE(p.provider_payment_id, '')   AS provider_reference,
  p.status::TEXT      AS payment_status
FROM public.billing_payments p
JOIN public.billing_invoices  i ON i.id = p.invoice_id
JOIN public.billing_customers c ON c.id = p.customer_id
ORDER BY p.received_at DESC;

-- Commission tracking for field sales agents (T4A box 048 - fees for services)
CREATE TABLE IF NOT EXISTS public.agent_commissions (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_user_id     UUID NOT NULL REFERENCES auth.users(id),
  agent_name        TEXT NOT NULL,
  agent_sin         TEXT,
  agent_address     TEXT,
  order_id          UUID REFERENCES public.orders(id),
  commission_amount NUMERIC(10,2) NOT NULL,
  commission_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method    TEXT DEFAULT 'e-transfer',
  payment_reference TEXT,
  tax_year          INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER,
  t4a_generated     BOOLEAN DEFAULT FALSE,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_commissions_tax_year ON public.agent_commissions(tax_year);
CREATE INDEX IF NOT EXISTS idx_agent_commissions_agent   ON public.agent_commissions(agent_user_id);

ALTER TABLE public.agent_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_commissions_service_role ON public.agent_commissions;
CREATE POLICY agent_commissions_service_role ON public.agent_commissions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS agent_commissions_admin_read ON public.agent_commissions;
CREATE POLICY agent_commissions_admin_read ON public.agent_commissions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','supervisor','billing_admin')
  ));

-- T4A annual summary: agents with >= $500 in fees (CRA mandatory threshold)
DROP VIEW IF EXISTS public.v_t4a_annual_summary CASCADE;
CREATE VIEW public.v_t4a_annual_summary AS
SELECT
  ac.tax_year,
  ac.agent_user_id,
  ac.agent_name,
  ac.agent_sin,
  SUM(ac.commission_amount)   AS total_fees_box048,
  COUNT(*)                    AS commission_count,
  MIN(ac.commission_date)     AS first_payment,
  MAX(ac.commission_date)     AS last_payment,
  BOOL_OR(ac.t4a_generated)   AS t4a_issued
FROM public.agent_commissions ac
GROUP BY ac.tax_year, ac.agent_user_id, ac.agent_name, ac.agent_sin, ac.agent_address
HAVING SUM(ac.commission_amount) >= 500
ORDER BY ac.tax_year DESC, ac.agent_name;

COMMENT ON VIEW public.v_monthly_revenue_summary IS 'Monthly revenue + TPS/TVQ for CRA remittances';
COMMENT ON VIEW public.v_annual_revenue_summary   IS 'Annual revenue for T2 corporate income tax';
COMMENT ON VIEW public.v_tax_remittance_report    IS 'Quarterly TPS/TVQ totals for CRA and Revenu Quebec';
COMMENT ON VIEW public.v_quickbooks_invoices      IS 'Invoice export — SELECT * to get CSV for QuickBooks import';
COMMENT ON VIEW public.v_quickbooks_payments      IS 'Payment export — SELECT * to get CSV for QuickBooks import';
COMMENT ON VIEW public.v_t4a_annual_summary       IS 'T4A summary per agent (box 048 fees >= $500 CRA threshold)';
COMMENT ON TABLE public.agent_commissions         IS 'Commission payments to field sales agents for T4A generation';
