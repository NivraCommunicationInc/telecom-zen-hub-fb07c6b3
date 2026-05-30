CREATE OR REPLACE FUNCTION public.admin_promote_order_to_confirmed(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow heavier trigger cascade (commission, contract, email, projections...) to finish.
  SET LOCAL statement_timeout = '30s';

  -- Authorization: only Nivra Core staff may promote
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorized to promote order status';
  END IF;

  UPDATE public.orders
     SET status = 'confirmed',
         updated_at = now()
   WHERE id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_promote_order_to_confirmed(uuid) TO authenticated;