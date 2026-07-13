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

    PERFORM public.queue_email(
      'tech_completed_support_' || NEW.id::text,
      'support@nivra-telecom.ca',
      'tech_completed',
      jsonb_build_object(
        'first_name','Support',
        'order_id', NEW.order_id,
        'assignment_id', NEW.id,
        'order_number', v_order.order_number
      )
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

        PERFORM public.queue_email(
          'review_request_activation_' || v_order.account_id::text,
          v_client_email,
          'review_request_activation',
          jsonb_build_object(
            'first_name', v_client_first,
            'account_id', v_order.account_id::text,
            'review_url', 'https://nivra-telecom.ca/avis/' || COALESCE(v_review_token::text, gen_random_uuid()::text),
            'google_review_url', 'https://g.page/r/Cc0xn5zgYussEBM/review',
            'language', v_client_lang
          )
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;