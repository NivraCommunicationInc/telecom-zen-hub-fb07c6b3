-- Drop and recreate view with new columns
DROP VIEW IF EXISTS public.employee_financial_summary;

CREATE VIEW public.employee_financial_summary
WITH (security_invoker = true) AS
SELECT
  u.id AS user_id,
  COALESCE(sc_paid.total, 0) + COALESCE(fc_paid.total, 0) AS total_earned,
  COALESCE(sc_pending.total, 0) + COALESCE(fc_pending.total, 0) AS pending_balance,
  COALESCE(sc_validated.total, 0) + COALESCE(fc_validated.total, 0) AS validated_balance,
  COALESCE(sc_payable.total, 0) + COALESCE(fc_payable.total, 0) AS payable_balance,
  COALESCE(sc_in_payroll.total, 0) + COALESCE(fc_in_payroll.total, 0) AS in_payroll_balance,
  COALESCE(wr_pending.total, 0) AS locked_balance,
  GREATEST(
    COALESCE(sc_payable.total, 0) + COALESCE(fc_payable.total, 0)
    - COALESCE(wr_pending.total, 0),
    0
  ) AS available_balance,
  COALESCE(sc_lost.total, 0) + COALESCE(fc_lost.total, 0) AS lost_total,
  COALESCE(wr_paid.total, 0) AS withdrawals_paid,
  COALESCE(pe_paid.commission_total, 0) AS paid_via_payroll
FROM auth.users u
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(commission_amount + COALESCE(bonus_amount, 0)), 0) AS total
  FROM sales_commissions WHERE salesperson_id = u.id AND status = 'paid'
) sc_paid ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(commission_amount + COALESCE(bonus_amount, 0)), 0) AS total
  FROM sales_commissions WHERE salesperson_id = u.id AND status IN ('pending', 'pending_activation')
) sc_pending ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(commission_amount + COALESCE(bonus_amount, 0)), 0) AS total
  FROM sales_commissions WHERE salesperson_id = u.id AND status IN ('validated', 'approved')
) sc_validated ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(commission_amount + COALESCE(bonus_amount, 0)), 0) AS total
  FROM sales_commissions WHERE salesperson_id = u.id AND status = 'payable'
) sc_payable ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(commission_amount + COALESCE(bonus_amount, 0)), 0) AS total
  FROM sales_commissions WHERE salesperson_id = u.id AND status = 'included_in_payroll'
) sc_in_payroll ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(commission_amount + COALESCE(bonus_amount, 0)), 0) AS total
  FROM sales_commissions WHERE salesperson_id = u.id AND status IN ('rejected', 'clawback')
) sc_lost ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(amount), 0) AS total
  FROM field_commissions WHERE agent_id = u.id AND status = 'paid'
) fc_paid ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(amount), 0) AS total
  FROM field_commissions WHERE agent_id = u.id AND status IN ('pending', 'pending_activation')
) fc_pending ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(amount), 0) AS total
  FROM field_commissions WHERE agent_id = u.id AND status IN ('validated', 'approved')
) fc_validated ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(amount), 0) AS total
  FROM field_commissions WHERE agent_id = u.id AND status = 'payable'
) fc_payable ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(amount), 0) AS total
  FROM field_commissions WHERE agent_id = u.id AND status = 'included_in_payroll'
) fc_in_payroll ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(amount), 0) AS total
  FROM field_commissions WHERE agent_id = u.id AND status IN ('rejected', 'clawback')
) fc_lost ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(amount), 0) AS total
  FROM commission_withdrawal_requests WHERE agent_id = u.id AND status = 'pending'
) wr_pending ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(amount), 0) AS total
  FROM commission_withdrawal_requests WHERE agent_id = u.id AND status = 'paid'
) wr_paid ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(commission_total), 0) AS commission_total
  FROM payroll_entries WHERE user_id = u.id AND status = 'paid'
) pe_paid ON true;

-- Enable realtime on commission tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'sales_commissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_commissions;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'field_commissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.field_commissions;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'commission_withdrawal_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.commission_withdrawal_requests;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'payroll_commission_links'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payroll_commission_links;
  END IF;
END $$;