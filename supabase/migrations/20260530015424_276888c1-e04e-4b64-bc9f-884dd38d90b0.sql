DROP FUNCTION IF EXISTS public.admin_promote_order_to_confirmed(UUID);

CREATE OR REPLACE FUNCTION public.admin_promote_order_to_confirmed(
  p_order_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
BEGIN
  -- Check permissions
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
    OR public.has_role(auth.uid(), 'supervisor')
    OR public.has_role(auth.uid(), 'billing_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Set long timeout for this operation
  SET LOCAL statement_timeout = '60s';

  -- Get order
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_paid', true
    );
  END IF;

  -- Simple direct update only
  -- No complex cascade
  UPDATE public.orders SET
    payment_status = 'paid',
    status = 'confirmed',
    payment_confirmed_at = now(),
    updated_at = now()
  WHERE id = p_order_id
  AND payment_status != 'paid';

  -- Log it
  INSERT INTO public.order_status_history (
    order_id,
    status,
    payment_status,
    changed_at,
    changed_by,
    notes
  ) VALUES (
    p_order_id,
    'confirmed',
    'paid',
    now(),
    auth.uid(),
    'Paiement confirmé manuellement'
  );

  -- Queue confirmation email
  INSERT INTO public.email_queue (
    to_email,
    template_key,
    template_vars,
    status
  )
  SELECT
    p.email,
    'order_payment_confirmed',
    jsonb_build_object(
      'first_name', p.first_name,
      'order_number', v_order.order_number,
      'total_amount', v_order.total_amount,
      'payment_method', 'Manuel'
    ),
    'queued'
  FROM public.orders o
  JOIN public.profiles p ON p.user_id = o.user_id
  WHERE o.id = p_order_id;

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'status', 'confirmed',
    'payment_status', 'paid'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

REVOKE ALL ON FUNCTION public.admin_promote_order_to_confirmed(UUID)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_promote_order_to_confirmed(UUID)
TO authenticated;