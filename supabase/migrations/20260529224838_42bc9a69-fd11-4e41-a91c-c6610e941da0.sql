-- Materialize a pending field_payment_intent into a canonical public.orders row
-- so Nivra Core can display & process it with the exact same UI/workflow as
-- any other order. Returns the resulting orders.id (or the existing
-- converted_order_id if already materialized).
CREATE OR REPLACE FUNCTION public.materialize_field_intent(p_intent_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_admin boolean;
  v_intent record;
  v_quote record;
  v_existing_order_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_user_id uuid;
  v_account_id uuid;
  v_first_name text;
  v_last_name text;
  v_client record;
  v_subtotal numeric := 0;
  v_tps numeric := 0;
  v_tvq numeric := 0;
  v_total numeric := 0;
  v_activation_fee numeric := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT public.has_role(v_caller, 'admin') OR public.has_role(v_caller, 'employee')
    INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Forbidden: admin or employee role required';
  END IF;

  SELECT * INTO v_intent
  FROM public.field_payment_intents
  WHERE id = p_intent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intent not found: %', p_intent_id;
  END IF;

  -- Already materialized? Return the existing canonical order id.
  IF v_intent.converted_order_id IS NOT NULL THEN
    RETURN v_intent.converted_order_id;
  END IF;

  -- Defensive: check if an order has already been created with this intent reference
  SELECT id INTO v_existing_order_id
  FROM public.orders
  WHERE notes ILIKE '%' || p_intent_id::text || '%'
  LIMIT 1;
  IF v_existing_order_id IS NOT NULL THEN
    UPDATE public.field_payment_intents
       SET converted_order_id = v_existing_order_id
     WHERE id = p_intent_id;
    RETURN v_existing_order_id;
  END IF;

  -- Pull the quote for totals + items if any
  IF v_intent.quote_id IS NOT NULL THEN
    SELECT * INTO v_quote
    FROM public.field_quotes
    WHERE id = v_intent.quote_id;
  END IF;

  -- Resolve client_user_id by email (do not auto-create auth user here)
  IF v_intent.customer_email IS NOT NULL THEN
    SELECT p.user_id INTO v_user_id
    FROM public.profiles p
    WHERE lower(p.email) = lower(v_intent.customer_email)
    LIMIT 1;
  END IF;

  -- If we still have no user, fall back to the agent as user_id so the order
  -- can be created; field-sales-sync will repair the identity later.
  IF v_user_id IS NULL THEN
    v_user_id := v_intent.agent_id;
  END IF;

  -- Resolve account by user
  IF v_user_id IS NOT NULL THEN
    SELECT id INTO v_account_id
    FROM public.accounts
    WHERE client_id = v_user_id
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- Split name
  IF v_intent.customer_name IS NOT NULL THEN
    v_first_name := split_part(v_intent.customer_name, ' ', 1);
    v_last_name  := NULLIF(regexp_replace(v_intent.customer_name, '^\S+\s*', ''), '');
  END IF;

  v_subtotal := COALESCE(v_quote.subtotal, v_intent.amount, 0);
  v_tps      := COALESCE(v_quote.tps, 0);
  v_tvq      := COALESCE(v_quote.tvq, 0);
  v_total    := COALESCE(v_quote.total, v_intent.amount, 0);
  v_activation_fee := COALESCE(v_quote.activation_fee, 0);

  v_order_number := 'NIV-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));

  INSERT INTO public.orders (
    user_id, account_id, order_number, created_by, source, created_by_agent_id,
    agent_name, client_email, client_phone, client_first_name, client_last_name,
    service_type, category,
    subtotal, activation_fee, tps_amount, tvq_amount, total_amount,
    status, payment_status, payment_method, payment_reference, amount_paid,
    shipping_address, shipping_city, shipping_postal_code,
    equipment_details, notes, internal_notes
  )
  VALUES (
    v_user_id, v_account_id, v_order_number, 'field_sales', 'field_sales', v_intent.agent_id,
    NULL, v_intent.customer_email, NULL, v_first_name, v_last_name,
    COALESCE(v_quote.service_type::text, 'Vente terrain'), 'Field Sales',
    v_subtotal, v_activation_fee, v_tps, v_tvq, v_total,
    'pending_payment', COALESCE(v_intent.status, 'pending'),
    CASE WHEN v_intent.payment_method = 'card_manual' THEN 'card_manual' ELSE v_intent.payment_method END,
    NULL, 0,
    NULL, NULL, NULL,
    CASE WHEN v_quote.equipment IS NOT NULL OR v_quote.services IS NOT NULL
         THEN jsonb_build_object('services', COALESCE(v_quote.services, '[]'::jsonb), 'equipment', COALESCE(v_quote.equipment, '[]'::jsonb))
         ELSE NULL END,
    'Vente terrain — Intent: ' || p_intent_id::text,
    '[VENTE TERRAIN — matérialisée depuis intent ' || p_intent_id::text || ']'
  )
  RETURNING id INTO v_order_id;

  UPDATE public.field_payment_intents
     SET converted_order_id = v_order_id
   WHERE id = p_intent_id;

  RETURN v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.materialize_field_intent(uuid) TO authenticated, service_role;