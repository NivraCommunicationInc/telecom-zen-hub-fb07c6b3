
-- Fix compensation guard: use current_user (reliable) instead of JWT claim
CREATE OR REPLACE FUNCTION public.guard_compensation_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.metadata ? 'compensation') THEN
    IF current_user <> 'service_role' THEN
      RAISE EXCEPTION 'compensation_direct_write_forbidden: use core-issue-compensation edge function';
    END IF;
    IF NEW.idempotency_key IS NULL THEN
      RAISE EXCEPTION 'compensation_idempotency_key_required';
    END IF;
    IF NEW.expires_at IS NULL THEN
      RAISE EXCEPTION 'compensation_expires_at_required';
    END IF;
    IF (NEW.metadata->'compensation'->>'category') IS NULL THEN
      RAISE EXCEPTION 'compensation_category_required';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix enqueue trigger: profiles PK is user_id, not id
CREATE OR REPLACE FUNCTION public.enqueue_account_adjustment_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client_id uuid;
  v_email text;
  v_first_name text;
  v_template text;
  v_amount text;
BEGIN
  -- Skip if this is a compensation row (handled by edge function directly)
  IF NEW.metadata ? 'compensation' THEN RETURN NEW; END IF;

  SELECT a.client_id INTO v_client_id FROM public.accounts a WHERE a.id = NEW.account_id;
  IF v_client_id IS NULL THEN RETURN NEW; END IF;
  SELECT p.email, p.first_name INTO v_email, v_first_name FROM public.profiles p WHERE p.user_id = v_client_id;
  IF v_email IS NULL OR v_email = '' THEN RETURN NEW; END IF;

  v_template := CASE
    WHEN NEW.type IN ('credit','first_month_free') THEN 'client_credit_added'
    WHEN NEW.type IN ('fee','one_time') THEN 'client_charge_added'
    ELSE NULL
  END;
  IF v_template IS NULL THEN RETURN NEW; END IF;

  v_amount := to_char(NEW.amount, 'FM999G999G990D00') || ' $';

  INSERT INTO public.email_queue (to_email, template_key, template_vars, status, priority)
  VALUES (
    v_email, v_template,
    jsonb_build_object(
      'first_name', coalesce(v_first_name, 'Client'),
      'amount', v_amount,
      'description', coalesce(NEW.description, ''),
      'months_total', NEW.months_total::text,
      'is_permanent', NEW.is_permanent::text,
      'reason', coalesce(NEW.description, '—'),
      'to_email', v_email
    ),
    'queued', 0
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;
