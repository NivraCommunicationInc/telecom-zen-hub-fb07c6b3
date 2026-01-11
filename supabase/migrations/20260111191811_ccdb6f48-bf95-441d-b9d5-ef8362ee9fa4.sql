-- Fix: Remove INSERT trigger that references OLD (NULL on INSERT)
-- Orders should not be inserted as completed; only UPDATE transitions matter
DROP TRIGGER IF EXISTS trigger_order_contest_entry_insert ON orders;