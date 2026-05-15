ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_payment_method_check
CHECK (
  payment_method IS NULL
  OR payment_method = ANY (
    ARRAY[
      'card'::text,
      'card_manual'::text,
      'etransfer'::text,
      'e_transfer'::text,
      'interac'::text,
      'paypal'::text,
      'apple_pay'::text,
      'google_pay'::text,
      'cash'::text,
      'promo_free'::text,
      'credit_card'::text
    ]
  )
);