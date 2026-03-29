-- Employee Financial Architecture: Wallet View + Withdrawal Validation

-- 1. Dynamic financial summary view
CREATE OR REPLACE VIEW public.employee_financial_summary
WITH (security_invoker = true) AS
SELECT
  u.id AS user_id,
  COALESCE(sc_paid.total, 0) + COALESCE(fc_paid.total, 0) AS total_earned,
  COALESCE(sc_pending.total, 0) + COALESCE(fc_pending.total, 0) AS pending_balance,
  COALESCE(sc_validated.total, 0) + COALESCE(fc_validated.total, 0) AS validated_balance,
  COALESCE(wr_pending.total, 0) AS locked_balance,
  COALESCE(pe_paid.commission_total, 0) AS paid_via_payroll,
  GREATEST(
    COALESCE(sc_validated.total, 0) + COALESCE(fc_validated.total, 0)
    + COALESCE(sc_paid.total, 0) + COALESCE(fc_paid.total, 0)
    - COALESCE(pe_paid.commission_total, 0)
    - COALESCE(wr_pending.total, 0)
    - COALESCE(wr_paid.total, 0),
    0
  ) AS available_balance,
  COALESCE(sc_lost.total, 0) + COALESCE(fc_lost.total, 0) AS lost_total,
  COALESCE(wr_paid.total, 0) AS withdrawals_paid
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

-- 2. Withdrawal balance check trigger
CREATE OR REPLACE FUNCTION public.check_withdrawal_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available numeric;
BEGIN
  SELECT available_balance INTO v_available
  FROM employee_financial_summary
  WHERE user_id = NEW.agent_id;

  IF v_available IS NULL OR v_available < NEW.amount THEN
    RAISE EXCEPTION 'Solde insuffisant. Disponible: % $, demandé: % $',
      COALESCE(v_available, 0), NEW.amount;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_withdrawal_balance ON commission_withdrawal_requests;
CREATE TRIGGER trg_check_withdrawal_balance
  BEFORE INSERT ON commission_withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION check_withdrawal_balance();