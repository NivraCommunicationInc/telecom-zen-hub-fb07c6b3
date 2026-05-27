CREATE OR REPLACE FUNCTION public.enqueue_customer_portal_projection_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  r record;
  v_user_ids uuid[] := ARRAY[]::uuid[];
  v_customer_id uuid;
  v_account_id uuid;
  v_order_id uuid;
  v_subscription_id uuid;
  v_row_id uuid;
  v_uid uuid;
  v_event_id uuid;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  v_customer_id := nullif(to_jsonb(r)->>'customer_id', '')::uuid;
  v_account_id := nullif(to_jsonb(r)->>'account_id', '')::uuid;
  v_order_id := coalesce(nullif(to_jsonb(r)->>'order_id', '')::uuid, nullif(to_jsonb(r)->>'related_order_id', '')::uuid);
  v_subscription_id := nullif(to_jsonb(r)->>'subscription_id', '')::uuid;
  v_row_id := nullif(to_jsonb(r)->>'id', '')::uuid;

  SELECT array_remove(array_agg(DISTINCT user_id), NULL) INTO v_user_ids
  FROM (
    SELECT nullif(to_jsonb(r)->>'user_id', '')::uuid AS user_id
    UNION SELECT nullif(to_jsonb(r)->>'client_id', '')::uuid
    UNION SELECT nullif(to_jsonb(r)->>'owner_user_id', '')::uuid
    UNION SELECT nullif(to_jsonb(r)->>'created_by_user_id', '')::uuid
    UNION SELECT bc.user_id FROM public.billing_customers bc WHERE bc.id = v_customer_id
    UNION SELECT a.client_id FROM public.accounts a WHERE a.id = v_account_id
    UNION SELECT o.user_id FROM public.orders o WHERE o.id = v_order_id
    UNION SELECT a.client_id FROM public.accounts a JOIN public.orders o ON o.account_id = a.id WHERE o.id = v_order_id
    UNION SELECT bc.user_id FROM public.billing_customers bc JOIN public.billing_subscriptions bs ON bs.customer_id = bc.id WHERE bs.id = v_subscription_id
  ) u;

  FOREACH v_uid IN ARRAY coalesce(v_user_ids, ARRAY[]::uuid[]) LOOP
    INSERT INTO public.customer_portal_projection_events (user_id, event_source, event_id, payload, status)
    VALUES (v_uid, TG_TABLE_NAME, v_row_id, jsonb_build_object('operation', TG_OP, 'table', TG_TABLE_NAME), 'processing')
    RETURNING id INTO v_event_id;

    BEGIN
      PERFORM public.refresh_customer_portal_snapshot_internal(v_uid, TG_TABLE_NAME, v_row_id);
      UPDATE public.customer_portal_projection_events
      SET status = 'processed', processed_at = now(), attempts = attempts + 1
      WHERE id = v_event_id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.customer_portal_projection_events
      SET status = 'failed', attempts = attempts + 1, last_error = SQLERRM
      WHERE id = v_event_id;
      INSERT INTO public.customer_portal_projection_logs (user_id, event_source, event_id, status, message, details)
      VALUES (v_uid, TG_TABLE_NAME, v_row_id, 'error', SQLERRM, jsonb_build_object('operation', TG_OP, 'sqlstate', SQLSTATE));
    END;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;