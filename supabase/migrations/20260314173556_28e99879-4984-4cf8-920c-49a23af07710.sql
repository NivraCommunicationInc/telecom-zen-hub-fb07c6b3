-- Enable client-side canonical checkout backfill inserts safely
-- 1) billing_customers insert for own user
CREATE POLICY "Clients insert own billing_customers"
ON public.billing_customers
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 2) billing_invoices insert for own customer/order chain
CREATE POLICY "Clients insert own billing_invoices"
ON public.billing_invoices
FOR INSERT
TO authenticated
WITH CHECK (
  customer_id IN (
    SELECT bc.id FROM public.billing_customers bc WHERE bc.user_id = auth.uid()
  )
  AND (
    order_id IS NULL
    OR order_id IN (
      SELECT o.id FROM public.orders o WHERE o.user_id = auth.uid()
    )
  )
);

-- 3) billing_payments insert for own customer+invoice chain
CREATE POLICY "Clients insert own billing_payments"
ON public.billing_payments
FOR INSERT
TO authenticated
WITH CHECK (
  customer_id IN (
    SELECT bc.id FROM public.billing_customers bc WHERE bc.user_id = auth.uid()
  )
  AND invoice_id IN (
    SELECT bi.id
    FROM public.billing_invoices bi
    JOIN public.billing_customers bc ON bc.id = bi.customer_id
    WHERE bc.user_id = auth.uid()
  )
);

-- 4) billing_subscriptions insert for own customer/order chain
CREATE POLICY "Clients insert own billing_subscriptions"
ON public.billing_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  customer_id IN (
    SELECT bc.id FROM public.billing_customers bc WHERE bc.user_id = auth.uid()
  )
  AND (
    order_id IS NULL
    OR order_id IN (
      SELECT o.id FROM public.orders o WHERE o.user_id = auth.uid()
    )
  )
);