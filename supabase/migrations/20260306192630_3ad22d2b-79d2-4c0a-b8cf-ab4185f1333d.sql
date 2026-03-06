-- Backfill: Link orphaned payment to its order
UPDATE payments 
SET order_id = '09cc272b-de97-4143-8174-58199178f287' 
WHERE id = 'cd9442f2-2d01-44f1-b449-1b55903da74d' 
AND order_id IS NULL;