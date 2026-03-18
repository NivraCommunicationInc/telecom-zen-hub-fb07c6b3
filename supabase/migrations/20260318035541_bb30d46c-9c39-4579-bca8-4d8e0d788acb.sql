
-- FIX: Force order 80876 total to canonical invoice total
UPDATE orders SET total_amount = 248.34 WHERE id = 'c692a860-b9cf-46b3-9705-0348ee086460';
