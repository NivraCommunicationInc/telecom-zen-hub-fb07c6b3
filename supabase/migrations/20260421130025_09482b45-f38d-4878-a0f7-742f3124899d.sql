-- ============================================================================
-- Table : paypal_autopay_attempts
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.paypal_autopay_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_id UUID NULL,
  billing_subscription_id UUID NULL,
  paypal_subscription_id TEXT NULL,
  paypal_plan_id TEXT NULL,
  approval_url TEXT NULL,
  status TEXT NOT NULL DEFAULT 'started',
  current_step TEXT NOT NULL DEFAULT 'click',
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT NULL,
  paypal_debug_id TEXT NULL,
  paypal_response JSONB NULL,
  http_status INTEGER NULL,
  ip_address TEXT NULL,
  user_agent TEXT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paypal_autopay_attempts_user
  ON public.paypal_autopay_attempts(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_paypal_autopay_attempts_paypal_sub
  ON public.paypal_autopay_attempts(paypal_subscription_id)
  WHERE paypal_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_paypal_autopay_attempts_status
  ON public.paypal_autopay_attempts(status);

ALTER TABLE public.paypal_autopay_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own autopay attempts"
ON public.paypal_autopay_attempts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all autopay attempts"
ON public.paypal_autopay_attempts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE TRIGGER trg_paypal_autopay_attempts_updated_at
BEFORE UPDATE ON public.paypal_autopay_attempts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Function : check_autopay_eligibility(target_user_id UUID)
-- Returns server-side eligibility decision based on Nivra Core data.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_autopay_eligibility(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer RECORD;
  v_account RECORD;
  v_eligible_sub RECORD;
  v_active_paypal_sub RECORD;
BEGIN
  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'no_user', 'subscription_id', null);
  END IF;

  -- Must have billing customer
  SELECT id, status INTO v_customer
  FROM billing_customers
  WHERE user_id = target_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'no_billing_customer', 'subscription_id', null);
  END IF;

  -- Block if any account has active chargeback
  SELECT id, has_active_chargeback, status
  INTO v_account
  FROM accounts
  WHERE client_id = target_user_id AND has_active_chargeback = true
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'active_chargeback', 'subscription_id', null);
  END IF;

  -- Already has an active PayPal autopay subscription?
  SELECT id, paypal_subscription_id
  INTO v_active_paypal_sub
  FROM billing_subscriptions
  WHERE customer_id = v_customer.id
    AND status = 'active'
    AND paypal_subscription_id IS NOT NULL
    AND auto_billing_enabled = true
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'already_active',
      'subscription_id', v_active_paypal_sub.id,
      'paypal_subscription_id', v_active_paypal_sub.paypal_subscription_id
    );
  END IF;

  -- Find a billable subscription that can be enrolled
  SELECT id, plan_name, plan_price, status
  INTO v_eligible_sub
  FROM billing_subscriptions
  WHERE customer_id = v_customer.id
    AND status IN ('active', 'pending', 'suspended')
    AND (paypal_subscription_id IS NULL)
    AND plan_price > 0
    AND order_id IS NOT NULL
  ORDER BY 
    CASE status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
    created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'no_eligible_subscription', 'subscription_id', null);
  END IF;

  RETURN jsonb_build_object(
    'eligible', true,
    'reason', 'ok',
    'subscription_id', v_eligible_sub.id,
    'plan_name', v_eligible_sub.plan_name,
    'plan_price', v_eligible_sub.plan_price,
    'subscription_status', v_eligible_sub.status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_autopay_eligibility(UUID) TO authenticated;