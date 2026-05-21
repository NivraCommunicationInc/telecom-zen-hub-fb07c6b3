CREATE OR REPLACE FUNCTION public.fn_create_review_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active'
  AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    INSERT INTO public.client_reviews (account_id, trigger_type, token_expires_at)
    VALUES (NEW.id, 'activation', now() + INTERVAL '30 days')
    ON CONFLICT DO NOTHING;

    INSERT INTO public.email_queue (to_email, template_key, template_vars, status)
    SELECT
      p.email,
      'review_request_activation',
      jsonb_build_object(
        'first_name', p.first_name,
        'review_url', 'https://nivra-telecom.ca/avis/' || cr.review_token::text,
        'google_review_url', 'https://g.page/r/Cc0xn5zgYussEBM/review'
      ),
      'queued'
    FROM public.accounts a
    JOIN public.profiles p ON p.user_id = a.user_id
    JOIN public.client_reviews cr ON cr.account_id = a.id
    WHERE a.id = NEW.id AND cr.trigger_type = 'activation'
    ORDER BY cr.created_at DESC LIMIT 1;
  END IF;

  IF NEW.status IN ('cancelled','terminated','deactivated','suspended_final')
  AND OLD.status NOT IN ('cancelled','terminated','deactivated','suspended_final') THEN
    INSERT INTO public.client_reviews (account_id, trigger_type, token_expires_at)
    VALUES (NEW.id, 'deactivation', now() + INTERVAL '30 days')
    ON CONFLICT DO NOTHING;

    INSERT INTO public.email_queue (to_email, template_key, template_vars, status)
    SELECT
      p.email,
      'review_request_deactivation',
      jsonb_build_object(
        'first_name', p.first_name,
        'review_url', 'https://nivra-telecom.ca/avis/' || cr.review_token::text,
        'google_review_url', 'https://g.page/r/Cc0xn5zgYussEBM/review'
      ),
      'queued'
    FROM public.accounts a
    JOIN public.profiles p ON p.user_id = a.user_id
    JOIN public.client_reviews cr ON cr.account_id = a.id
    WHERE a.id = NEW.id AND cr.trigger_type = 'deactivation'
    ORDER BY cr.created_at DESC LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_review_request ON public.accounts;
CREATE TRIGGER trg_review_request
AFTER UPDATE OF status ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.fn_create_review_request();