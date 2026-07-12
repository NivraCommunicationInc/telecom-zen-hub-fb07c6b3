CREATE OR REPLACE FUNCTION public.rpc_qa_seed_subscription_fixture(p_row jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  IF COALESCE(p_row->>'environment','') <> 'test' THEN
    RAISE EXCEPTION 'QA_SEED_ENVIRONMENT_MUST_BE_TEST';
  END IF;
  IF (p_row->>'source_type') IS NULL OR (p_row->>'source_id') IS NULL THEN
    RAISE EXCEPTION 'QA_SEED_REQUIRES_SOURCE_TYPE_AND_SOURCE_ID';
  END IF;

  INSERT INTO public.billing_subscriptions (
    customer_id, plan_code, plan_name, plan_price,
    cycle_start_date, cycle_end_date, status, service_category,
    environment, source_type, source_id, source_order_item_id, order_id,
    frozen_name, frozen_code, frozen_unit_price,
    frozen_currency, frozen_cycle, frozen_frequency, frozen_anchor_date
  ) VALUES (
    (p_row->>'customer_id')::uuid,
    p_row->>'plan_code',
    p_row->>'plan_name',
    (p_row->>'plan_price')::numeric,
    NULLIF(p_row->>'cycle_start_date','')::date,
    NULLIF(p_row->>'cycle_end_date','')::date,
    COALESCE(p_row->>'status','active')::billing_subscription_status,
    p_row->>'service_category',
    'test',
    p_row->>'source_type',
    p_row->>'source_id',
    NULLIF(p_row->>'source_order_item_id','')::uuid,
    NULLIF(p_row->>'order_id','')::uuid,
    p_row->>'frozen_name',
    p_row->>'frozen_code',
    NULLIF(p_row->>'frozen_unit_price','')::numeric,
    COALESCE(p_row->>'frozen_currency','CAD'),
    COALESCE(p_row->>'frozen_cycle','monthly'),
    COALESCE(p_row->>'frozen_frequency','monthly'),
    NULLIF(p_row->>'frozen_anchor_date','')::date
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;