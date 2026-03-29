
-- P0-1: Direct fix for 2 stuck subscriptions
UPDATE billing_subscriptions SET status = 'active', updated_at = now()
WHERE id = 'be44d9c2-4194-4bd2-8921-1b9e1068ea60' AND status = 'pending';

UPDATE billing_subscriptions SET status = 'active', updated_at = now()
WHERE id = '0991ae8d-94cb-43d6-908b-206f87124a22' AND status = 'pending';
