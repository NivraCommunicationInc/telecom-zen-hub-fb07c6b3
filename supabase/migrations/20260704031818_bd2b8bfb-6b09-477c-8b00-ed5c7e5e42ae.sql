GRANT SELECT, INSERT, UPDATE ON public.service_addresses TO authenticated;
GRANT ALL ON public.service_addresses TO service_role;

CREATE OR REPLACE FUNCTION public.get_account_service_tree(_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = _account_id AND a.client_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
    OR public.has_role(auth.uid(), 'moderator')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT jsonb_build_object(
    'account_id', _account_id,
    'addresses', COALESCE(jsonb_agg(addr_obj ORDER BY created_at), '[]'::jsonb)
  ) INTO result
  FROM (
    SELECT sa.created_at, jsonb_build_object(
      'address', to_jsonb(sa.*),
      'subscriptions', COALESCE((SELECT jsonb_agg(to_jsonb(s.*)) FROM public.subscriptions s WHERE s.service_address_id = sa.id), '[]'::jsonb),
      'equipment', COALESCE((SELECT jsonb_agg(to_jsonb(e.*)) FROM public.equipment_inventory e WHERE e.service_address_id = sa.id), '[]'::jsonb),
      'appointments', COALESCE((SELECT jsonb_agg(to_jsonb(ap.*)) FROM public.appointments ap WHERE ap.service_address_id = sa.id), '[]'::jsonb),
      'tickets', COALESCE((SELECT jsonb_agg(to_jsonb(t.*)) FROM public.support_tickets t WHERE t.service_address_id = sa.id), '[]'::jsonb),
      'incidents', COALESCE((SELECT jsonb_agg(to_jsonb(i.*)) FROM public.service_incidents i WHERE i.service_address_id = sa.id), '[]'::jsonb)
    ) AS addr_obj
    FROM public.service_addresses sa
    WHERE sa.account_id = _account_id AND sa.deleted_at IS NULL
  ) sub;

  RETURN COALESCE(result, jsonb_build_object('account_id', _account_id, 'addresses', '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_account_service_tree(uuid) TO authenticated, service_role;