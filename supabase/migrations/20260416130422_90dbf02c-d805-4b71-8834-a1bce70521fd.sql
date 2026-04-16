ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS equipment_refunded boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS equipment_refund_date timestamptz DEFAULT null;