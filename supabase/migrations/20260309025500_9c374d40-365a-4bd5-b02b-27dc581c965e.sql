
-- Temporarily disable the lock trigger to fix invalid account numbers
ALTER TABLE accounts DISABLE TRIGGER trg_lock_account_number;

-- Fix invalid account_number by triggering the enforce format trigger
UPDATE accounts 
SET account_number = generate_secure_account_number()
WHERE account_number !~ '^[2-9][0-9]{5}$';

-- Re-enable the lock trigger
ALTER TABLE accounts ENABLE TRIGGER trg_lock_account_number;

-- Backfill: Link orders to accounts where account_id is null
UPDATE orders o
SET account_id = (
  SELECT a.id FROM accounts a WHERE a.client_id = o.user_id ORDER BY a.created_at ASC LIMIT 1
)
WHERE o.account_id IS NULL
  AND EXISTS (SELECT 1 FROM accounts a WHERE a.client_id = o.user_id);
