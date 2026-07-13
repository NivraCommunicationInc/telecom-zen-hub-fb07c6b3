CREATE OR REPLACE FUNCTION public.fn_installation_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_client_email TEXT;
  v_client_first TEXT;
  v_client_lang TEXT;
  v_review_token UUID;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    UPDATE public.orders
       SET status = 'completed',
           updated_at = now()
     WHERE id = NEW.order_id
    RETURNING * INTO v_order;

    IF v_order.account_id IS NOT NULL THEN
      UPDATE public.accounts
         SET status = 'active',
             updated_at = now()
       WHERE id = v_order.account_id;
    END IF;

    IF v_order.account_id IS NOT NULL THEN
      SELECT p.email, p.first_name, COALESCE(p.language, 'fr')
        INTO v_client_email, v_client_first, v_client_lang
        FROM public.accounts a
        LEFT JOIN public.profiles p ON p.user_id = a.user_id
       WHERE a.id = v_order.account_id;
    END IF;

    v_client_email := COALESCE(v_client_email, v_order.client_email);
    v_client_first := COALESCE(v_client_first, v_order.client_first_name, 'Client');
    v_client_lang := COALESCE(v_client_lang, 'fr');

    PERFORM public.rpc_communication_enqueue(
      p_channel => 'email',
      p_template_key => 'tech_completed',
      p_recipient => 'support@nivra-telecom.ca',
      p_template_vars => jsonb_build_object(
        'first_name','Support',
        'order_id', NEW.order_id,
        'assignment_id', NEW.id,
        'order_number', v_order.order_number
      ),
      p_idempotency_key => 'tech_completed_support_' || NEW.id::text,
      p_category => 'operational',
      p_actor_role => 'system',
      p_entity_type => 'technician_assignment',
      p_entity_id => NEW.id::text,
      p_reason => 'Installation marked completed'
    );

    IF v_order.account_id IS NOT NULL AND v_client_email IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.accounts WHERE id = v_order.account_id AND status = 'active')
         AND NOT EXISTS (
           SELECT 1 FROM public.client_reviews
            WHERE account_id = v_order.account_id
              AND status = 'submitted'
         )
         AND NOT EXISTS (
           SELECT 1 FROM public.email_queue
            WHERE template_key = 'review_request_activation'
              AND created_at > now() - INTERVAL '30 days'
              AND (template_vars->>'account_id') = v_order.account_id::text
         )
      THEN
        INSERT INTO public.client_reviews (account_id, trigger_type, token_expires_at, status)
        VALUES (v_order.account_id, 'activation', now() + INTERVAL '30 days', 'pending')
        ON CONFLICT DO NOTHING;

        SELECT review_token INTO v_review_token
          FROM public.client_reviews
         WHERE account_id = v_order.account_id
           AND trigger_type = 'activation'
         ORDER BY created_at DESC LIMIT 1;

        PERFORM public.rpc_communication_enqueue(
          p_channel => 'email',
          p_template_key => 'review_request_activation',
          p_recipient => v_client_email,
          p_template_vars => jsonb_build_object(
            'first_name', v_client_first,
            'account_id', v_order.account_id::text,
            'review_url', 'https://nivra-telecom.ca/avis/' || COALESCE(v_review_token::text, gen_random_uuid()::text),
            'google_review_url', 'https://g.page/r/Cc0xn5zgYussEBM/review',
            'language', v_client_lang
          ),
          p_idempotency_key => 'review_request_activation_' || v_order.account_id::text,
          p_category => 'transactional',
          p_actor_role => 'system',
          p_entity_type => 'account',
          p_entity_id => v_order.account_id::text,
          p_reason => 'Activation review request after completed installation'
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_billing_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_client_email text;
  v_client_name text;
  v_template_key text;
  v_event_key text;
BEGIN
  SELECT email, COALESCE(full_name, 'Client')
  INTO v_client_email, v_client_name
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  IF v_client_email IS NULL THEN
    v_client_email := NEW.client_email;
  END IF;

  IF v_client_email IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_template_key := 'invoice_created';
    v_event_key := 'invoice_created_' || NEW.id::text;
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'paid' THEN
        v_template_key := 'payment_received';
        v_event_key := 'payment_received_' || NEW.id::text;
      WHEN 'overdue' THEN
        v_template_key := 'invoice_overdue';
        v_event_key := 'invoice_overdue_' || NEW.id::text;
      WHEN 'failed', 'declined' THEN
        IF NEW.order_id IS NOT NULL THEN
          RETURN NEW;
        END IF;
        v_template_key := 'payment_failed';
        v_event_key := 'payment_failed_' || NEW.id::text;
      ELSE
        RETURN NEW;
    END CASE;
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.rpc_communication_enqueue(
    p_channel => 'email',
    p_template_key => v_template_key,
    p_recipient => v_client_email,
    p_template_vars => jsonb_build_object(
      'client_name', v_client_name,
      'invoice_id', NEW.id,
      'invoice_number', NEW.invoice_number,
      'amount', NEW.amount,
      'due_date', NEW.due_date,
      'status', NEW.status
    ),
    p_idempotency_key => v_event_key,
    p_category => CASE WHEN v_template_key IN ('payment_received','payment_failed','invoice_overdue') THEN 'billing' ELSE 'transactional' END,
    p_actor_role => 'system',
    p_entity_type => 'billing_invoice',
    p_entity_id => NEW.id::text,
    p_reason => 'Billing invoice status notification'
  );

  RETURN NEW;
END;
$function$;