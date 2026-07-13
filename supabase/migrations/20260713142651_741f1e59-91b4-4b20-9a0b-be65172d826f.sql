
UPDATE public.orders
SET fulfillment_type = 'ship'
WHERE fulfillment_type IS NULL
  AND installation_type = 'auto'
  AND status NOT IN ('cancelled','refunded')
  AND coalesce(payment_method,'') <> 'paypal';
