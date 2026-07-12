UPDATE public.orders
   SET total_amount = 0, subtotal = 0, tps_amount = 0, tvq_amount = 0,
       delivery_fee = 0, activation_fee = 0, installation_fee = 0,
       router_fee = 0, terminal_fee = 0, discount_amount = 0,
       promo_discount_amount = 0, shipping_fee_cents = 0
 WHERE id = '5dc1e845-a6f8-4322-9589-9f96ad2929f4';

DO $$
DECLARE v_invoice_id uuid;
BEGIN
  v_invoice_id := public.build_invoice_from_order('5dc1e845-a6f8-4322-9589-9f96ad2929f4'::uuid, '{"qa":"phase6.5-step2"}'::jsonb);
  RAISE NOTICE 'QA STEP2 invoice_id=%', v_invoice_id;
END $$;