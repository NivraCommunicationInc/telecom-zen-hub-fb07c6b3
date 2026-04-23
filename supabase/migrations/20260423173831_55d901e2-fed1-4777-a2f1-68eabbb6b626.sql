-- Cleanup orphan sales_commissions and payroll_entries
-- Identified by audit: 2 commissions + 4 payroll entries reference deleted test data

DELETE FROM public.sales_commissions
WHERE (field_order_id IS NOT NULL AND field_order_id NOT IN (SELECT id FROM public.orders))
   OR (converted_order_id IS NOT NULL AND converted_order_id NOT IN (SELECT id FROM public.orders));

DELETE FROM public.payroll_entries
WHERE user_id IS NOT NULL
  AND user_id NOT IN (SELECT user_id FROM public.employee_records WHERE user_id IS NOT NULL);