CREATE OR REPLACE FUNCTION public.get_account_service_tree(_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = _account_id AND a.client_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
    OR public.has_role(auth.uid(), 'support')
    OR public.has_role(auth.uid(), 'supervisor')
    OR public.has_role(auth.uid(), 'ops')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  WITH acct AS (
    SELECT a.* FROM public.accounts a WHERE a.id = _account_id
  ),
  active_addresses AS (
    SELECT sa.*
    FROM public.service_addresses sa
    WHERE sa.account_id = _account_id
      AND sa.deleted_at IS NULL
  ),
  address_count AS (
    SELECT count(*)::int AS n FROM active_addresses
  ),
  account_customers AS (
    SELECT bc.id
    FROM public.billing_customers bc
    JOIN acct a ON a.client_id = bc.user_id
  ),
  address_orders AS (
    SELECT o.*
    FROM public.orders o
    JOIN acct a ON (o.account_id = a.id OR o.user_id = a.client_id)
  ),
  address_nodes AS (
    SELECT
      sa.created_at,
      jsonb_build_object(
        'address', to_jsonb(sa.*),
        'subscriptions', COALESCE((
          SELECT jsonb_agg(to_jsonb(bs.*) ORDER BY bs.created_at DESC)
          FROM public.billing_subscriptions bs
          WHERE bs.customer_id IN (SELECT id FROM account_customers)
            AND (
              bs.service_address_id = sa.id
              OR bs.address_id = sa.id
              OR EXISTS (
                SELECT 1 FROM address_orders o
                WHERE o.id = bs.order_id AND o.service_address_id = sa.id
              )
            )
        ), '[]'::jsonb),
        'service_instances', COALESCE((
          SELECT jsonb_agg(to_jsonb(si.*) ORDER BY si.created_at DESC)
          FROM public.service_instances si
          WHERE si.account_id = _account_id
            AND (
              si.service_address_id = sa.id
              OR EXISTS (
                SELECT 1 FROM address_orders o
                WHERE o.id = si.order_id AND o.service_address_id = sa.id
              )
              OR ((SELECT n FROM address_count) = 1 AND si.service_address_id IS NULL)
            )
        ), '[]'::jsonb),
        'equipment', COALESCE((
          SELECT jsonb_agg(to_jsonb(e.*) ORDER BY COALESCE(e.assigned_at, e.created_at) DESC)
          FROM public.equipment_inventory e
          WHERE (
            e.service_address_id = sa.id
            OR e.address_id = sa.id
            OR EXISTS (
              SELECT 1 FROM public.billing_subscriptions bs
              WHERE bs.id = e.subscription_id
                AND bs.customer_id IN (SELECT id FROM account_customers)
                AND (bs.service_address_id = sa.id OR bs.address_id = sa.id)
            )
            OR EXISTS (
              SELECT 1 FROM address_orders o
              WHERE o.id = e.order_id AND o.service_address_id = sa.id
            )
            OR ((SELECT n FROM address_count) = 1 AND e.account_id = _account_id AND e.service_address_id IS NULL AND e.address_id IS NULL AND e.order_id IS NULL AND e.subscription_id IS NULL)
          )
        ), '[]'::jsonb),
        'appointments', COALESCE((
          SELECT jsonb_agg(to_jsonb(ap.*) ORDER BY ap.scheduled_at DESC NULLS LAST, ap.created_at DESC)
          FROM public.appointments ap
          JOIN acct a ON true
          WHERE (
            ap.service_address_id = sa.id
            OR EXISTS (
              SELECT 1 FROM address_orders o
              WHERE o.id = ap.order_id AND o.service_address_id = sa.id
            )
            OR ((SELECT n FROM address_count) = 1 AND ap.client_id = a.client_id AND ap.service_address_id IS NULL AND ap.order_id IS NULL)
          )
        ), '[]'::jsonb),
        'tickets', COALESCE((
          SELECT jsonb_agg(to_jsonb(t.*) ORDER BY t.created_at DESC)
          FROM public.support_tickets t
          WHERE (
            t.service_address_id = sa.id
            OR EXISTS (
              SELECT 1 FROM address_orders o
              WHERE (o.id = t.related_order_id OR o.id = t.linked_order_id) AND o.service_address_id = sa.id
            )
            OR ((SELECT n FROM address_count) = 1 AND t.account_id = _account_id AND t.service_address_id IS NULL AND t.related_order_id IS NULL AND t.linked_order_id IS NULL)
          )
        ), '[]'::jsonb),
        'incidents', COALESCE((
          SELECT jsonb_agg(to_jsonb(i.*) ORDER BY COALESCE(i.started_at, i.created_at) DESC)
          FROM public.service_incidents i
          WHERE (
            i.service_address_id = sa.id
            OR ((SELECT n FROM address_count) = 1 AND i.client_account_id = _account_id AND i.service_address_id IS NULL)
          )
        ), '[]'::jsonb)
      ) AS addr_obj
    FROM active_addresses sa
  )
  SELECT jsonb_build_object(
    'account_id', _account_id,
    'addresses', COALESCE(jsonb_agg(addr_obj ORDER BY created_at), '[]'::jsonb)
  ) INTO result
  FROM address_nodes;

  RETURN COALESCE(result, jsonb_build_object('account_id', _account_id, 'addresses', '[]'::jsonb));
END;
$$;