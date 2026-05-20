
-- ============================================================
-- TASK 5 — Client Reviews System
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  review_token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('activation','deactivation')),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  service_quality INTEGER CHECK (service_quality BETWEEN 1 AND 5),
  support_quality INTEGER CHECK (support_quality BETWEEN 1 AND 5),
  value_for_money INTEGER CHECK (value_for_money BETWEEN 1 AND 5),
  would_recommend BOOLEAN,
  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','archived')),
  is_featured BOOLEAN NOT NULL DEFAULT false,
  admin_response TEXT,
  admin_responded_by UUID REFERENCES public.profiles(user_id),
  admin_responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_reviews_account ON public.client_reviews(account_id);
CREATE INDEX IF NOT EXISTS idx_client_reviews_status  ON public.client_reviews(status);
CREATE INDEX IF NOT EXISTS idx_client_reviews_featured ON public.client_reviews(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_client_reviews_submitted_at ON public.client_reviews(submitted_at DESC);

-- Avoid duplicate active pending request per (account, trigger_type)
CREATE UNIQUE INDEX IF NOT EXISTS uq_client_reviews_account_trigger_pending
  ON public.client_reviews(account_id, trigger_type)
  WHERE status = 'pending';

ALTER TABLE public.client_reviews ENABLE ROW LEVEL SECURITY;

-- Only Core admins can read all reviews
DROP POLICY IF EXISTS "Core admins read all reviews" ON public.client_reviews;
CREATE POLICY "Core admins read all reviews"
  ON public.client_reviews
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Only Core admins can update (response / featured / archive)
DROP POLICY IF EXISTS "Core admins update reviews" ON public.client_reviews;
CREATE POLICY "Core admins update reviews"
  ON public.client_reviews
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Deny anonymous direct access (RPCs below are the only public path)
DROP POLICY IF EXISTS "Deny anon direct access" ON public.client_reviews;
CREATE POLICY "Deny anon direct access"
  ON public.client_reviews
  FOR ALL TO anon
  USING (false) WITH CHECK (false);

-- ============================================================
-- Public secure RPC #1 — fetch by token
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_client_review_by_token(p_token UUID)
RETURNS TABLE (
  id UUID,
  trigger_type TEXT,
  status TEXT,
  token_expires_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  first_name TEXT,
  account_number TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cr.id,
    cr.trigger_type,
    cr.status,
    cr.token_expires_at,
    cr.submitted_at,
    COALESCE(p.first_name, split_part(COALESCE(p.full_name,''),' ',1), 'Client') AS first_name,
    a.account_number
  FROM public.client_reviews cr
  JOIN public.accounts a ON a.id = cr.account_id
  LEFT JOIN public.profiles p ON p.user_id = a.client_id
  WHERE cr.review_token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_review_by_token(UUID) TO anon, authenticated;

-- ============================================================
-- Public secure RPC #2 — submit review
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_client_review_by_token(
  p_token UUID,
  p_rating INTEGER,
  p_review_text TEXT,
  p_service_quality INTEGER,
  p_support_quality INTEGER,
  p_value_for_money INTEGER,
  p_would_recommend BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.client_reviews;
  v_first TEXT;
BEGIN
  SELECT * INTO v_row FROM public.client_reviews WHERE review_token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_row.token_expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;
  IF v_row.status = 'submitted' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_submitted');
  END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_rating');
  END IF;
  IF p_would_recommend IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'recommend_required');
  END IF;
  IF p_review_text IS NOT NULL AND length(p_review_text) > 1000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'text_too_long');
  END IF;

  UPDATE public.client_reviews
  SET rating = p_rating,
      review_text = NULLIF(trim(COALESCE(p_review_text,'')),''),
      service_quality = p_service_quality,
      support_quality = p_support_quality,
      value_for_money = p_value_for_money,
      would_recommend = p_would_recommend,
      submitted_at = now(),
      status = 'submitted'
  WHERE id = v_row.id;

  -- Internal notification email
  SELECT COALESCE(p.first_name, 'Client') INTO v_first
  FROM public.accounts a
  LEFT JOIN public.profiles p ON p.user_id = a.client_id
  WHERE a.id = v_row.account_id;

  INSERT INTO public.email_queue (event_key, to_email, template_key, template_vars, status)
  VALUES (
    'review_submitted_' || v_row.id::text,
    'nivratelecom@gmail.com',
    'review_submitted_internal',
    jsonb_build_object(
      'first_name', v_first,
      'rating', p_rating,
      'trigger_type', v_row.trigger_type,
      'review_id', v_row.id::text
    ),
    'queued'
  ) ON CONFLICT (event_key) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'first_name', v_first);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_client_review_by_token(UUID,INTEGER,TEXT,INTEGER,INTEGER,INTEGER,BOOLEAN) TO anon, authenticated;

-- ============================================================
-- Trigger on accounts.status — auto-create review request + email
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_create_review_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review public.client_reviews;
  v_email TEXT;
  v_first TEXT;
BEGIN
  IF NEW.status = 'active' AND COALESCE(OLD.status,'') <> 'active' THEN
    INSERT INTO public.client_reviews (account_id, trigger_type, token_expires_at)
    VALUES (NEW.id, 'activation', now() + INTERVAL '30 days')
    ON CONFLICT (account_id, trigger_type) WHERE status = 'pending' DO NOTHING
    RETURNING * INTO v_review;

    IF v_review.id IS NULL THEN
      SELECT * INTO v_review FROM public.client_reviews
      WHERE account_id = NEW.id AND trigger_type = 'activation'
      ORDER BY created_at DESC LIMIT 1;
    END IF;

    SELECT p.email, COALESCE(p.first_name,'Client') INTO v_email, v_first
    FROM public.profiles p WHERE p.user_id = NEW.client_id;

    IF v_email IS NOT NULL AND v_review.id IS NOT NULL THEN
      INSERT INTO public.email_queue (event_key, to_email, template_key, template_vars, status)
      VALUES (
        'review_request_activation_' || v_review.id::text,
        v_email,
        'review_request_activation',
        jsonb_build_object(
          'first_name', v_first,
          'review_url', 'https://nivra-telecom.ca/avis/' || v_review.review_token::text
        ),
        'queued'
      ) ON CONFLICT (event_key) DO NOTHING;
    END IF;
  END IF;

  IF NEW.status IN ('cancelled','terminated','deactivated')
     AND COALESCE(OLD.status,'') NOT IN ('cancelled','terminated','deactivated') THEN
    INSERT INTO public.client_reviews (account_id, trigger_type, token_expires_at)
    VALUES (NEW.id, 'deactivation', now() + INTERVAL '30 days')
    ON CONFLICT (account_id, trigger_type) WHERE status = 'pending' DO NOTHING
    RETURNING * INTO v_review;

    IF v_review.id IS NULL THEN
      SELECT * INTO v_review FROM public.client_reviews
      WHERE account_id = NEW.id AND trigger_type = 'deactivation'
      ORDER BY created_at DESC LIMIT 1;
    END IF;

    SELECT p.email, COALESCE(p.first_name,'Client') INTO v_email, v_first
    FROM public.profiles p WHERE p.user_id = NEW.client_id;

    IF v_email IS NOT NULL AND v_review.id IS NOT NULL THEN
      INSERT INTO public.email_queue (event_key, to_email, template_key, template_vars, status)
      VALUES (
        'review_request_deactivation_' || v_review.id::text,
        v_email,
        'review_request_deactivation',
        jsonb_build_object(
          'first_name', v_first,
          'review_url', 'https://nivra-telecom.ca/avis/' || v_review.review_token::text
        ),
        'queued'
      ) ON CONFLICT (event_key) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_review_request ON public.accounts;
CREATE TRIGGER trg_review_request
AFTER UPDATE OF status ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.fn_create_review_request();
