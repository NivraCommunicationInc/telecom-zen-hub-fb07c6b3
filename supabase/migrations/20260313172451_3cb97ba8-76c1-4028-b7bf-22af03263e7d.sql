-- Fix order 23345: link to the correct account
UPDATE orders 
SET account_id = 'b91ebece-b37e-4dcb-bf24-14e143fea601'
WHERE id = '7eef321c-7946-4ee9-9221-be68bff023e6'
AND account_id IS NULL;