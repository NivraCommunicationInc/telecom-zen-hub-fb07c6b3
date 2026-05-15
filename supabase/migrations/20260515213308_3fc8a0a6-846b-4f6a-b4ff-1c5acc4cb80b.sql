ALTER TABLE public.field_sales_orders
ADD COLUMN IF NOT EXISTS discount_data JSONB;