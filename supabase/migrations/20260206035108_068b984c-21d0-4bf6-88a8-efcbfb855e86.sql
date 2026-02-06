-- FIX: Mettre à jour la contrainte payment_method pour inclure paypal
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check 
CHECK (
  payment_method IS NULL 
  OR payment_method = ANY (ARRAY[
    'card', 
    'etransfer', 
    'e_transfer', 
    'interac',
    'paypal',
    'apple_pay', 
    'google_pay',
    'cash',
    'promo_free',
    'credit_card'
  ])
);