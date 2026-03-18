
-- FIX 2 RETRY: Order 80876 total must match canonical invoice total 248.34
UPDATE orders SET total_amount = 248.34 WHERE order_number = '80876';
