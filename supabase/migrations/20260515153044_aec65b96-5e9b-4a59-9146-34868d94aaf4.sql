ALTER TABLE public.field_sales_orders
DROP CONSTRAINT IF EXISTS field_sales_orders_payment_method_check;

ALTER TABLE public.field_sales_orders
ADD CONSTRAINT field_sales_orders_payment_method_check
CHECK (payment_method = ANY (ARRAY['interac'::text, 'paypal'::text, 'deferred'::text, 'card_manual'::text]));