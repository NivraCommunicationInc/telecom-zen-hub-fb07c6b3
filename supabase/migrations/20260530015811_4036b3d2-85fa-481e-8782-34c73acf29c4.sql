CREATE OR REPLACE FUNCTION public.admin_promote_order_to_confirmed(
  p_order_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
    OR public.has_role(auth.uid(), 'supervisor')
    OR public.has_role(auth.uid(), 'billing_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SET LOCAL statement_timeout = '60s';

  ALTER TABLE public.orders DISABLE TRIGGER USER;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    ALTER TABLE public.orders ENABLE TRIGGER USER;
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF v_order.payment_status = 'paid' THEN
    ALTER TABLE public.orders ENABLE TRIGGER USER;
    RETURN jsonb_build_object(
      'ok', true,
      'already_paid', true
    );
  END IF;

  UPDATE public.orders SET
    payment_status = 'paid',
    status = 'confirmed',
    payment_confirmed_at = now(),
    updated_at = now()
  WHERE id = p_order_id
  AND payment_status != 'paid';

  ALTER TABLE public.orders ENABLE TRIGGER USER;

  INSERT INTO public.order_status_history (
    order_id,
    status_domain,
    old_status,
    new_status,
    actor_user_id,
    actor_role,
    actor_name,
    change_reason,
    metadata
  ) VALUES (
    p_order_id,
    'payment',
    v_order.payment_status,
    'paid',
    auth.uid(),
    'admin',
    'Nivra Core',
    'Paiement confirmé manuellement',
    jsonb_build_object('order_status', 'confirmed')
  );

  INSERT INTO public.email_queue (
    event_key,
    to_email,
    template_key,
    template_vars,
    status,
    entity_type,
    entity_id
  )
  SELECT
    'order_payment_confirmed:' || p_order_id::text,
    p.email,
    'order_payment_confirmed',
    jsonb_build_object(
      'first_name', p.first_name,
      'order_number', v_order.order_number,
      'total_amount', v_order.total_amount,
      'payment_method', 'Manuel'
    ),
    'queued',
    'order',
    p_order_id::text
  FROM public.profiles p
  WHERE p.user_id = v_order.user_id
  ON CONFLICT (event_key) DO NOTHING;

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'status', 'confirmed',
    'payment_status', 'paid'
  );

EXCEPTION WHEN OTHERS THEN
  BEGIN
    ALTER TABLE public.orders ENABLE TRIGGER USER;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

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