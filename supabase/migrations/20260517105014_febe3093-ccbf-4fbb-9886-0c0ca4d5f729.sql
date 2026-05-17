ALTER TABLE pay_periods DROP CONSTRAINT IF EXISTS pay_periods_status_check;
ALTER TABLE pay_periods ADD CONSTRAINT pay_periods_status_check
CHECK (status IN ('open','pending','processing','closed','completed','cancelled','draft','approved','paid'));