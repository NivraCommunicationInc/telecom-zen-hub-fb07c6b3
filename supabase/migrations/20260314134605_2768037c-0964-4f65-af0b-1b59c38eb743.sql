-- Fix orphaned orders that have null account_id but their user has an account
UPDATE orders o
SET account_id = (
  SELECT a.id FROM accounts a WHERE a.client_id = o.user_id LIMIT 1
)
WHERE o.account_id IS NULL
  AND o.environment = 'live'
  AND EXISTS (SELECT 1 FROM accounts a WHERE a.client_id = o.user_id);