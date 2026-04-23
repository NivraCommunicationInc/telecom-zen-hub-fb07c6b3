CREATE OR REPLACE FUNCTION public.check_autopay_eligibility(target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer RECORD;
  v_active_paypal_sub RECORD;
  v_any_sub RECORD;
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

  -- Find ANY subscription on this customer that does not yet have a paypal_subscription_id.
  -- Relaxed: accept any status, any plan_price (autopay flow no longer blocks on price/order).
  SELECT id, plan_name, plan_price, status
  INTO v_any_sub
  FROM billing_subscriptions
  WHERE customer_id = v_customer.id
    AND (paypal_subscription_id IS NULL)
  ORDER BY
    CASE status
      WHEN 'active' THEN 0
      WHEN 'pending' THEN 1
      WHEN 'suspended' THEN 2
      ELSE 3
    END,
    created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    -- Still allow enrollment; client side will pass an explicit billing_subscription_id
    -- if it has one, otherwise the edge function will create/use a placeholder flow.
    RETURN jsonb_build_object(
      'eligible', true,
      'reason', 'ok_no_subscription',
      'subscription_id', null
    );
  END IF;

  RETURN jsonb_build_object(
    'eligible', true,
    'reason', 'ok',
    'subscription_id', v_any_sub.id,
    'plan_name', v_any_sub.plan_name,
    'plan_price', v_any_sub.plan_price,
    'subscription_status', v_any_sub.status
  );
END;
$function$;