CREATE OR REPLACE FUNCTION public.admin_promote_order_to_confirmed(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev_status text;
  v_prev_payment text;
BEGIN
  SET LOCAL statement_timeout = '30s';

  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'employee'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR public.has_role(auth.uid(), 'billing_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorized to promote order status';
  END IF;

  SELECT status, payment_status INTO v_prev_status, v_prev_payment
    FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF v_prev_status IS NULL THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  UPDATE public.orders
     SET status = 'confirmed',
         payment_status = 'paid',
         payment_confirmed_at = COALESCE(payment_confirmed_at, now()),
         updated_at = now()
   WHERE id = p_order_id;

  INSERT INTO public.order_status_history (
    order_id, status_domain, old_status, new_status,
    actor_user_id, actor_role, actor_name, change_reason, metadata
  ) VALUES (
    p_order_id, 'payment', v_prev_payment, 'paid',
    auth.uid(), 'admin', 'Nivra Core', 'Paiement confirmé manuellement',
    jsonb_build_object('prev_order_status', v_prev_status)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_promote_order_to_confirmed(uuid) TO authenticated;