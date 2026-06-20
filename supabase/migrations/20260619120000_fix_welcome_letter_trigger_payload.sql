-- Fix trg_doc_welcome_letter_on_order:
-- 1. Add monthly_amount/total_amount/plan_name from billing_subscriptions + order
-- 2. Override null profile fields (first_name, last_name, phone) with order snapshot
-- 3. Patch billing_address.city/postal_code from order shipping fields when null

CREATE OR REPLACE FUNCTION public.trg_doc_welcome_letter_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_account_id uuid;
  v_email      text;
  v_payload    jsonb;
  v_plan_price numeric;
  v_plan_name  text;
BEGIN
  SELECT id INTO v_account_id
  FROM public.accounts
  WHERE client_id = NEW.user_id
  ORDER BY created_at DESC LIMIT 1;

  SELECT email INTO v_email FROM public.profiles WHERE user_id = NEW.user_id;

  SELECT plan_price, plan_name INTO v_plan_price, v_plan_name
  FROM public.billing_subscriptions
  WHERE order_id = NEW.id
  ORDER BY created_at DESC LIMIT 1;

  v_payload := public._build_doc_client_payload(NEW.user_id, v_account_id)
    || jsonb_build_object(
        'letter_number',  'BVN-' || to_char(now(), 'YYYYMMDD') || '-' || SUBSTRING(NEW.id::text, 1, 8),
        'created_at',     NEW.created_at,
        'order_id',       NEW.id,
        'monthly_amount', COALESCE(v_plan_price, NEW.subtotal, 0),
        'total_amount',   COALESCE(NEW.total_amount, 0),
        'plan_name',      COALESCE(v_plan_name, NEW.service_type, '')
    );

  -- Override null profile fields with order snapshot data
  IF NEW.client_first_name IS NOT NULL THEN
    v_payload := v_payload || jsonb_build_object('first_name', NEW.client_first_name);
  END IF;
  IF NEW.client_last_name IS NOT NULL THEN
    v_payload := v_payload || jsonb_build_object('last_name', NEW.client_last_name);
  END IF;
  IF NEW.client_phone IS NOT NULL THEN
    v_payload := v_payload || jsonb_build_object('phone', NEW.client_phone);
  END IF;

  -- Patch billing_address city/postal_code from shipping fields when null
  IF v_payload->'billing_address' IS NULL THEN
    v_payload := v_payload || jsonb_build_object('billing_address', '{}'::jsonb);
  END IF;
  IF (v_payload->'billing_address'->>'city') IS NULL AND NEW.shipping_city IS NOT NULL THEN
    v_payload := jsonb_set(v_payload, '{billing_address,city}', to_jsonb(NEW.shipping_city));
  END IF;
  IF (v_payload->'billing_address'->>'postal_code') IS NULL AND NEW.shipping_postal_code IS NOT NULL THEN
    v_payload := jsonb_set(v_payload, '{billing_address,postal_code}', to_jsonb(NEW.shipping_postal_code));
  END IF;

  PERFORM public.enqueue_document_job(
    v_account_id, NEW.user_id, 'welcome_letter', 'order.activated',
    'welcome_letter::order::' || NEW.id::text,
    COALESCE(v_email, NEW.client_email), v_payload
  );
  RETURN NEW;
END; $function$;
