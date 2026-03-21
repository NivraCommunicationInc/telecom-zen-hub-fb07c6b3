-- Fix accounts with wrong billing_cycle_day
-- These accounts were created on March 21 but got default billing_cycle_day=1
-- Canonical rule: billing_cycle_day = day of order/service start

UPDATE accounts 
SET billing_cycle_day = EXTRACT(DAY FROM billing_anchor_date::date)::integer
WHERE billing_cycle_day = 1 
  AND billing_anchor_date IS NOT NULL 
  AND EXTRACT(DAY FROM billing_anchor_date::date)::integer != 1;