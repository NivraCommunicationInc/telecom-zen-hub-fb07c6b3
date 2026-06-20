-- Tous les scores calculés (DB de test)
SELECT
  cs.client_id,
  p.email,
  cs.current_score,
  cs.credit_grade,
  cs.grade_label,
  cs.invoices_paid,
  cs.invoices_overdue,
  cs.invoices_bad_debt,
  cs.chargebacks,
  cs.account_age_days,
  cs.has_history,
  cs.factors
FROM account_credit_scores cs
LEFT JOIN profiles p ON p.user_id = cs.client_id
ORDER BY cs.current_score ASC;
