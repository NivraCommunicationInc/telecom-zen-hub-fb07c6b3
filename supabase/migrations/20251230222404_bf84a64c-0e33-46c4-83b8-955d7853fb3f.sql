-- Fix client payment submission failing due to missing RLS INSERT policy

-- Payments: allow authenticated users to create payment rows for themselves
DO $$
BEGIN
  -- Ensure RLS is enabled (should already be)
  EXECUTE 'ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN others THEN
  -- ignore
END $$;

DROP POLICY IF EXISTS "Users can insert their own payments" ON public.payments;
CREATE POLICY "Users can insert their own payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Optional: explicitly deny anonymous inserts/selects are already effectively denied by auth.uid() = user_id,
-- but we keep anon blocked for inserts via absence of policies to anon.


-- Billing: client-side payment flow also updates invoice rows; allow users to update their own billing rows
DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.billing ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN others THEN
  -- ignore
END $$;

DROP POLICY IF EXISTS "Users can update their own billing" ON public.billing;
CREATE POLICY "Users can update their own billing"
ON public.billing
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Note: Admin policies already exist for billing/payments via has_role(auth.uid(),'admin').
