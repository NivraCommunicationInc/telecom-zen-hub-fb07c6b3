
-- =========================================================================
-- FEATURE 1 — Analytics views (CAC, LTV, Profit)
-- =========================================================================
CREATE OR REPLACE VIEW public.cac_metric
WITH (security_invoker = on) AS
SELECT
  COALESCE(
    (SELECT SUM(amount) FROM public.field_commissions WHERE status = 'paid'),
    0
  ) / NULLIF(
    (SELECT COUNT(DISTINCT id) FROM public.billing_subscriptions WHERE status = 'active'),
    0
  ) AS cac_per_client,
  COALESCE(
    (SELECT SUM(amount) FROM public.field_commissions WHERE status = 'paid'),
    0
  ) AS total_acquisition_cost,
  (SELECT COUNT(DISTINCT id) FROM public.billing_subscriptions WHERE status = 'active') AS total_active_clients;

CREATE OR REPLACE VIEW public.ltv_metric
WITH (security_invoker = on) AS
SELECT
  AVG(bs.plan_price)::numeric AS avg_monthly_revenue,
  AVG(
    EXTRACT(EPOCH FROM (
      COALESCE(
        CASE WHEN bs.status::text = 'cancelled' THEN bs.updated_at END,
        now()
      ) - bs.created_at
    )) / (30 * 24 * 3600)
  )::numeric AS avg_lifespan_months,
  (
    AVG(bs.plan_price) * AVG(
      EXTRACT(EPOCH FROM (
        COALESCE(
          CASE WHEN bs.status::text = 'cancelled' THEN bs.updated_at END,
          now()
        ) - bs.created_at
      )) / (30 * 24 * 3600)
    )
  )::numeric AS ltv
FROM public.billing_subscriptions bs
WHERE bs.status::text IN ('active', 'cancelled');

CREATE OR REPLACE VIEW public.profit_per_client
WITH (security_invoker = on) AS
SELECT
  AVG(bs.plan_price)::numeric AS avg_revenue,
  (AVG(bs.plan_price) * 0.53)::numeric AS avg_wholesale_cost,
  (AVG(bs.plan_price) * 0.10)::numeric AS avg_support_cost,
  (AVG(bs.plan_price) * 0.02)::numeric AS avg_infra_cost,
  (AVG(bs.plan_price) * 0.35)::numeric AS avg_profit_per_client,
  ((AVG(bs.plan_price) * 0.35) * COUNT(DISTINCT bs.id))::numeric AS total_monthly_profit
FROM public.billing_subscriptions bs
WHERE bs.status::text = 'active';

GRANT SELECT ON public.cac_metric TO authenticated;
GRANT SELECT ON public.ltv_metric TO authenticated;
GRANT SELECT ON public.profit_per_client TO authenticated;

-- =========================================================================
-- FEATURE 3 — Onboarding sequences
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.onboarding_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id UUID,
  activation_date TIMESTAMPTZ NOT NULL,
  day1_sent_at TIMESTAMPTZ,
  day3_sent_at TIMESTAMPTZ,
  day7_sent_at TIMESTAMPTZ,
  day30_sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_sequences_status_active
  ON public.onboarding_sequences (status, activation_date)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_onboarding_sequences_account
  ON public.onboarding_sequences (account_id);

ALTER TABLE public.onboarding_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage onboarding sequences" ON public.onboarding_sequences;
CREATE POLICY "Admins manage onboarding sequences"
  ON public.onboarding_sequences
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger: create onboarding sequence when order becomes activated
CREATE OR REPLACE FUNCTION public.tg_create_onboarding_sequence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status::text = 'activated' AND COALESCE(OLD.status::text, '') <> 'activated')
     OR (TG_OP = 'INSERT' AND NEW.status::text = 'activated') THEN
    IF NEW.account_id IS NOT NULL THEN
      INSERT INTO public.onboarding_sequences (account_id, client_id, activation_date)
      VALUES (NEW.account_id, NEW.user_id, now())
      ON CONFLICT (account_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_activation_onboarding ON public.orders;
CREATE TRIGGER trg_orders_activation_onboarding
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_create_onboarding_sequence();

CREATE OR REPLACE FUNCTION public.process_onboarding_sequences()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq RECORD;
BEGIN
  FOR v_seq IN
    SELECT os.id, os.account_id, os.client_id, os.activation_date,
           os.day1_sent_at, os.day3_sent_at, os.day7_sent_at, os.day30_sent_at,
           p.email, p.full_name, p.preferred_language,
           a.account_number
    FROM public.onboarding_sequences os
    LEFT JOIN public.profiles p ON p.user_id = os.client_id
    LEFT JOIN public.accounts a ON a.id = os.account_id
    WHERE os.status = 'active'
      AND p.email IS NOT NULL
  LOOP
    -- Day 1
    IF v_seq.day1_sent_at IS NULL
       AND now() >= v_seq.activation_date + INTERVAL '1 day' THEN
      INSERT INTO public.email_queue (event_key, to_email, template_key, template_vars, language, status)
      VALUES (
        'onboard_d1_' || v_seq.id::text,
        v_seq.email,
        'onboarding_day1',
        jsonb_build_object(
          'client_name', COALESCE(v_seq.full_name, 'Client'),
          'account_number', COALESCE(v_seq.account_number, '')
        ),
        COALESCE(v_seq.preferred_language, 'fr'),
        'queued'
      )
      ON CONFLICT (event_key) DO NOTHING;
      UPDATE public.onboarding_sequences SET day1_sent_at = now() WHERE id = v_seq.id;
    END IF;

    -- Day 3
    IF v_seq.day3_sent_at IS NULL
       AND now() >= v_seq.activation_date + INTERVAL '3 days' THEN
      INSERT INTO public.email_queue (event_key, to_email, template_key, template_vars, language, status)
      VALUES (
        'onboard_d3_' || v_seq.id::text,
        v_seq.email,
        'onboarding_day3',
        jsonb_build_object('client_name', COALESCE(v_seq.full_name, 'Client')),
        COALESCE(v_seq.preferred_language, 'fr'),
        'queued'
      )
      ON CONFLICT (event_key) DO NOTHING;
      UPDATE public.onboarding_sequences SET day3_sent_at = now() WHERE id = v_seq.id;
    END IF;

    -- Day 7
    IF v_seq.day7_sent_at IS NULL
       AND now() >= v_seq.activation_date + INTERVAL '7 days' THEN
      INSERT INTO public.email_queue (event_key, to_email, template_key, template_vars, language, status)
      VALUES (
        'onboard_d7_' || v_seq.id::text,
        v_seq.email,
        'onboarding_day7',
        jsonb_build_object(
          'client_name', COALESCE(v_seq.full_name, 'Client'),
          'account_number', COALESCE(v_seq.account_number, '')
        ),
        COALESCE(v_seq.preferred_language, 'fr'),
        'queued'
      )
      ON CONFLICT (event_key) DO NOTHING;
      UPDATE public.onboarding_sequences SET day7_sent_at = now() WHERE id = v_seq.id;
    END IF;

    -- Day 30
    IF v_seq.day30_sent_at IS NULL
       AND now() >= v_seq.activation_date + INTERVAL '30 days' THEN
      INSERT INTO public.email_queue (event_key, to_email, template_key, template_vars, language, status)
      VALUES (
        'onboard_d30_' || v_seq.id::text,
        v_seq.email,
        'onboarding_day30',
        jsonb_build_object(
          'client_name', COALESCE(v_seq.full_name, 'Client'),
          'account_number', COALESCE(v_seq.account_number, ''),
          'referral_link', 'https://nivra-telecom.ca/commander'
        ),
        COALESCE(v_seq.preferred_language, 'fr'),
        'queued'
      )
      ON CONFLICT (event_key) DO NOTHING;
      UPDATE public.onboarding_sequences
        SET day30_sent_at = now(), status = 'completed'
        WHERE id = v_seq.id;
    END IF;
  END LOOP;
END;
$$;

-- =========================================================================
-- FEATURE 5 — SOP documents
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.sop_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_fr TEXT NOT NULL,
  title_en TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'ventes','support','technique','rh','facturation','securite','incidents','general'
  )),
  content_fr TEXT NOT NULL,
  content_en TEXT,
  version TEXT NOT NULL DEFAULT '1.0',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_public_to_agents BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sop_documents_category ON public.sop_documents(category);
CREATE INDEX IF NOT EXISTS idx_sop_documents_active ON public.sop_documents(is_active) WHERE is_active = true;

ALTER TABLE public.sop_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage sops" ON public.sop_documents;
CREATE POLICY "Admins manage sops"
  ON public.sop_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can read active sops" ON public.sop_documents;
CREATE POLICY "Authenticated can read active sops"
  ON public.sop_documents FOR SELECT TO authenticated
  USING (is_active = true);

DROP TRIGGER IF EXISTS trg_sop_documents_updated_at ON public.sop_documents;
CREATE TRIGGER trg_sop_documents_updated_at
  BEFORE UPDATE ON public.sop_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- FEATURE 6 — Client testimonials
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.client_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  client_city TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  service_type TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'internal'
    CHECK (source IN ('internal','google','facebook')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage testimonials" ON public.client_testimonials;
CREATE POLICY "Admins manage testimonials"
  ON public.client_testimonials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can submit testimonial" ON public.client_testimonials;
CREATE POLICY "Authenticated can submit testimonial"
  ON public.client_testimonials FOR INSERT TO authenticated
  WITH CHECK (is_approved = false);

CREATE OR REPLACE FUNCTION public.get_featured_testimonials()
RETURNS TABLE (
  id UUID,
  client_name TEXT,
  client_city TEXT,
  rating INTEGER,
  comment TEXT,
  service_type TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, client_name, client_city, rating, comment, service_type, created_at
  FROM public.client_testimonials
  WHERE is_approved = true AND is_featured = true
  ORDER BY created_at DESC
  LIMIT 12;
$$;

GRANT EXECUTE ON FUNCTION public.get_featured_testimonials() TO anon, authenticated;

-- =========================================================================
-- FEATURE 8 — Support metrics view
-- =========================================================================
CREATE OR REPLACE VIEW public.support_metrics
WITH (security_invoker = on) AS
SELECT
  COUNT(*) AS total_tickets,
  COUNT(*) FILTER (WHERE status = 'open') AS open_tickets,
  COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_tickets,
  AVG(
    EXTRACT(EPOCH FROM (
      COALESCE(
        (SELECT MIN(tr.created_at) FROM public.ticket_replies tr WHERE tr.ticket_id = st.id),
        now()
      ) - st.created_at
    )) / 3600
  )::numeric AS avg_first_response_hours,
  AVG(
    CASE WHEN st.status = 'resolved'
      THEN EXTRACT(EPOCH FROM (st.updated_at - st.created_at)) / 3600
    END
  )::numeric AS avg_resolution_hours
FROM public.support_tickets st;

GRANT SELECT ON public.support_metrics TO authenticated;
