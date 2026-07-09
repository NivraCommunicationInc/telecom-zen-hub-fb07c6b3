UPDATE public.billing_customers
SET square_customer_id = NULL,
    square_card_id     = NULL,
    square_card_brand  = NULL,
    square_card_last4  = NULL,
    autopay_enabled    = false,
    autopay_discount_active = false
WHERE id = 'd97815e8-d35a-4f71-a2c0-0b5e1af5bbd2';