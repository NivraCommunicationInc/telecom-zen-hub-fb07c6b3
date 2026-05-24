-- =========================================
-- A1. Helper de rôle staff
-- =========================================
CREATE OR REPLACE FUNCTION public.has_staff_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','employee','supervisor','support','billing_admin','kyc_agent','techops')
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_staff_role(uuid) TO authenticated, service_role;

-- =========================================
-- B1. Email claim challenges
-- =========================================
CREATE TABLE IF NOT EXISTS public.email_claim_challenges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  target_email text NOT NULL,
  code_hash    text NOT NULL,
  attempts     integer NOT NULL DEFAULT 0,
  verified_at  timestamptz,
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_claim_user ON public.email_claim_challenges(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_claim_email ON public.email_claim_challenges(lower(target_email), created_at DESC);

ALTER TABLE public.email_claim_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own claim challenges" ON public.email_claim_challenges;
CREATE POLICY "own claim challenges"
  ON public.email_claim_challenges
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Inserts/updates only via SECURITY DEFINER edge function (service role)
DROP POLICY IF EXISTS "staff read claim challenges" ON public.email_claim_challenges;
CREATE POLICY "staff read claim challenges"
  ON public.email_claim_challenges
  FOR SELECT TO authenticated
  USING (public.has_staff_role(auth.uid()));

-- =========================================
-- B1. Count function (no data leak — counters only)
-- =========================================
CREATE OR REPLACE FUNCTION public.count_claimable_records(_email text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(_email));
  v_orders int;
  v_quotes int;
  v_docs   int;
BEGIN
  IF v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object('orders',0,'quotes',0,'auto_docs',0,'total',0);
  END IF;

  SELECT count(*) INTO v_orders
    FROM public.orders
    WHERE user_id IS NULL AND lower(client_email) = v_email;

  SELECT count(*) INTO v_quotes
    FROM public.quotes
    WHERE customer_user_id IS NULL AND lower(prospect_email) = v_email;

  SELECT count(*) INTO v_docs
    FROM public.client_auto_documents
    WHERE client_id IS NULL AND lower(recipient_email) = v_email;

  RETURN jsonb_build_object(
    'orders', v_orders,
    'quotes', v_quotes,
    'auto_docs', v_docs,
    'total', v_orders + v_quotes + v_docs
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_claimable_records(text) TO authenticated, service_role;

-- =========================================
-- B1. Apply claim — only called by edge function after verification
-- =========================================
CREATE OR REPLACE FUNCTION public.apply_email_claim(_user_id uuid, _email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(_email));
  v_orders int := 0;
  v_quotes int := 0;
  v_docs   int := 0;
BEGIN
  IF _user_id IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'invalid_args';
  END IF;

  WITH upd AS (
    UPDATE public.orders
       SET user_id = _user_id
     WHERE user_id IS NULL AND lower(client_email) = v_email
     RETURNING 1
  )
  SELECT count(*) INTO v_orders FROM upd;

  WITH upd AS (
    UPDATE public.quotes
       SET customer_user_id = _user_id
     WHERE customer_user_id IS NULL AND lower(prospect_email) = v_email
     RETURNING 1
  )
  SELECT count(*) INTO v_quotes FROM upd;

  WITH upd AS (
    UPDATE public.client_auto_documents
       SET client_id = _user_id
     WHERE client_id IS NULL AND lower(recipient_email) = v_email
     RETURNING 1
  )
  SELECT count(*) INTO v_docs FROM upd;

  INSERT INTO public.admin_audit_log (admin_user_id, admin_email, action, target_type, target_id, target_email, details)
  VALUES (
    _user_id,
    v_email,
    'account_ops.claim_apply',
    'user',
    _user_id,
    v_email,
    jsonb_build_object('orders', v_orders, 'quotes', v_quotes, 'auto_docs', v_docs)
  );

  RETURN jsonb_build_object(
    'orders', v_orders, 'quotes', v_quotes, 'auto_docs', v_docs,
    'total', v_orders + v_quotes + v_docs
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_email_claim(uuid, text) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_email_claim(uuid, text) TO service_role;