
UPDATE billing_customers
SET user_id = 'd97815e8-d35a-4f71-a2c0-0b5e1af5bbd2'
WHERE id = 'd97815e8-d35a-4f71-a2c0-0b5e1af5bbd2' AND user_id IS NULL;

INSERT INTO billing_invoices (
  id, customer_id, subscription_id, invoice_number, type,
  subtotal, tps_amount, tvq_amount, total,
  currency, status, cycle_start_date, cycle_end_date, due_date,
  amount_paid, balance_due, environment, account_id
)
SELECT
  gen_random_uuid(),
  'd97815e8-d35a-4f71-a2c0-0b5e1af5bbd2',
  'fd8767a4-2415-458b-9835-22384505eedf',
  'QA-MOD7-' || to_char(now(),'YYYYMMDDHH24MISS'),
  'renewal',
  50.00, 2.50, 4.99, 57.49,
  'CAD', 'pending',
  (now()::date - INTERVAL '5 days')::date,
  (now()::date + INTERVAL '25 days')::date,
  (now()::date + INTERVAL '10 days')::date,
  0, 57.49, 'test',
  '6c163bc0-0831-40d9-a27f-91b80d59a73a'
WHERE NOT EXISTS (
  SELECT 1 FROM billing_invoices bi
  WHERE bi.customer_id = 'd97815e8-d35a-4f71-a2c0-0b5e1af5bbd2'
    AND bi.environment = 'test'
    AND bi.status IN ('pending','partially_paid','overdue','draft')
    AND bi.invoice_number LIKE 'QA-MOD7-%'
);
