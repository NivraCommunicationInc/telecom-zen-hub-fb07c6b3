
-- ============================================================
-- BACKFILL: Temporarily disable ALL triggers and constraints
-- ============================================================

-- 1. Disable triggers on payments table
ALTER TABLE payments DISABLE TRIGGER trigger_prevent_double_payment;
ALTER TABLE payments DISABLE TRIGGER trigger_update_invoice_balance;
ALTER TABLE payments DISABLE TRIGGER trg_recompute_invoice_on_payment;
ALTER TABLE payments DISABLE TRIGGER trigger_create_ledger_on_payment;
-- Keep validate_payment_created_by enabled for audit trail

-- 2. Drop CHECK constraint on billing temporarily
ALTER TABLE billing DROP CONSTRAINT IF EXISTS chk_billing_balance_due_positive;

-- 3. Disable trigger on billing
ALTER TABLE billing DISABLE TRIGGER trg_protect_paid_invoice;

-- 4. Insert all adjustment payments
INSERT INTO payments (billing_id, user_id, amount, status, payment_method, reference_number, source, created_by_id, created_by_name, created_by_role, notes)
VALUES (
  'df2e1a02-5978-482b-88be-a6726effa644',
  (SELECT user_id FROM billing WHERE id = 'df2e1a02-5978-482b-88be-a6726effa644'),
  218.72, 'captured', 'adjustment', 'ADJ-MIG-001',
  'system_migration', '00000000-0000-0000-0000-000000000000', 'System Migration', 'system',
  'Migration adjustment - historical payment reconciliation'
);

INSERT INTO payments (billing_id, user_id, amount, status, payment_method, reference_number, source, created_by_id, created_by_name, created_by_role, notes)
VALUES (
  'dac623f9-e6d3-46dc-8a05-33231d2c724e',
  (SELECT user_id FROM billing WHERE id = 'dac623f9-e6d3-46dc-8a05-33231d2c724e'),
  65.54, 'captured', 'adjustment', 'ADJ-MIG-002',
  'system_migration', '00000000-0000-0000-0000-000000000000', 'System Migration', 'system',
  'Migration adjustment - historical payment reconciliation'
);

INSERT INTO payments (billing_id, user_id, amount, status, payment_method, reference_number, source, created_by_id, created_by_name, created_by_role, notes)
VALUES (
  '5508fa0c-02ec-4ed7-8422-16e610342b84',
  (SELECT user_id FROM billing WHERE id = '5508fa0c-02ec-4ed7-8422-16e610342b84'),
  103.48, 'captured', 'adjustment', 'ADJ-MIG-003',
  'system_migration', '00000000-0000-0000-0000-000000000000', 'System Migration', 'system',
  'Migration adjustment - historical payment reconciliation'
);

INSERT INTO payments (billing_id, user_id, amount, status, payment_method, reference_number, source, created_by_id, created_by_name, created_by_role, notes)
VALUES (
  'b29cf2e1-c1ed-49de-b4c6-bdaeda85f0d4',
  (SELECT user_id FROM billing WHERE id = 'b29cf2e1-c1ed-49de-b4c6-bdaeda85f0d4'),
  120.72, 'captured', 'adjustment', 'ADJ-MIG-004',
  'system_migration', '00000000-0000-0000-0000-000000000000', 'System Migration', 'system',
  'Migration adjustment - historical payment reconciliation'
);

INSERT INTO payments (billing_id, user_id, amount, status, payment_method, reference_number, source, created_by_id, created_by_name, created_by_role, notes)
VALUES (
  '9326eb22-6137-41c9-84b3-07b3828a14a5',
  (SELECT user_id FROM billing WHERE id = '9326eb22-6137-41c9-84b3-07b3828a14a5'),
  22.46, 'captured', 'adjustment', 'ADJ-MIG-005',
  'system_migration', '00000000-0000-0000-0000-000000000000', 'System Migration', 'system',
  'Migration adjustment - historical payment reconciliation'
);

INSERT INTO payments (billing_id, user_id, amount, status, payment_method, reference_number, source, created_by_id, created_by_name, created_by_role, notes)
VALUES (
  'c1f0ecda-fedd-4444-886a-6ed62905426c',
  (SELECT user_id FROM billing WHERE id = 'c1f0ecda-fedd-4444-886a-6ed62905426c'),
  14.15, 'captured', 'adjustment', 'ADJ-MIG-006',
  'system_migration', '00000000-0000-0000-0000-000000000000', 'System Migration', 'system',
  'Migration adjustment - historical payment reconciliation'
);

INSERT INTO payments (billing_id, user_id, amount, status, payment_method, reference_number, source, created_by_id, created_by_name, created_by_role, notes)
VALUES (
  'c7296eb8-6918-471d-8e28-44fba2ad3202',
  (SELECT user_id FROM billing WHERE id = 'c7296eb8-6918-471d-8e28-44fba2ad3202'),
  29.95, 'captured', 'adjustment', 'ADJ-MIG-007',
  'system_migration', '00000000-0000-0000-0000-000000000000', 'System Migration', 'system',
  'Migration adjustment - historical payment reconciliation'
);

INSERT INTO payments (billing_id, user_id, amount, status, payment_method, reference_number, source, created_by_id, created_by_name, created_by_role, notes)
VALUES (
  '086dd18f-47f6-4d6c-83e6-000156ac39de',
  (SELECT user_id FROM billing WHERE id = '086dd18f-47f6-4d6c-83e6-000156ac39de'),
  12.08, 'captured', 'adjustment', 'ADJ-MIG-008',
  'system_migration', '00000000-0000-0000-0000-000000000000', 'System Migration', 'system',
  'Migration adjustment - historical payment reconciliation'
);

-- 5. Re-enable all triggers on payments
ALTER TABLE payments ENABLE TRIGGER trigger_prevent_double_payment;
ALTER TABLE payments ENABLE TRIGGER trigger_update_invoice_balance;
ALTER TABLE payments ENABLE TRIGGER trg_recompute_invoice_on_payment;
ALTER TABLE payments ENABLE TRIGGER trigger_create_ledger_on_payment;

-- 6. Re-enable trigger on billing
ALTER TABLE billing ENABLE TRIGGER trg_protect_paid_invoice;

-- 7. Re-add CHECK constraint
ALTER TABLE billing ADD CONSTRAINT chk_billing_balance_due_positive CHECK (balance_due >= 0);
