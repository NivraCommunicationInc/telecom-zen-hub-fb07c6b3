-- ═══ Field Sales Config ═══
CREATE TABLE public.field_sales_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  config_type TEXT NOT NULL DEFAULT 'text' CHECK (config_type IN ('number', 'text', 'boolean', 'json')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.field_sales_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage field config"
  ON public.field_sales_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can read field config"
  ON public.field_sales_config FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'employee') OR
    public.has_role(auth.uid(), 'field_sales')
  );

-- ═══ Service Coverage Areas ═══
CREATE TABLE public.service_coverage_areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  postal_prefix TEXT NOT NULL,
  coverage_type TEXT NOT NULL DEFAULT 'full' CHECK (coverage_type IN ('full', 'limited', 'unavailable')),
  available_services JSONB NOT NULL DEFAULT '["internet","tv","mobile"]'::jsonb,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(postal_prefix)
);

ALTER TABLE public.service_coverage_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage coverage areas"
  ON public.service_coverage_areas FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read coverage"
  ON public.service_coverage_areas FOR SELECT
  TO authenticated
  USING (true);

-- ═══ Seed config ═══
INSERT INTO public.field_sales_config (config_key, config_value, config_type, description) VALUES
  ('activation_fee_single', '25', 'number', 'Frais d''activation pour 1 service ($)'),
  ('activation_fee_multi', '45', 'number', 'Frais d''activation pour 2+ services ($)'),
  ('daily_sales_goal', '3', 'number', 'Objectif de ventes par jour'),
  ('monthly_sales_goal', '20', 'number', 'Objectif de ventes par mois'),
  ('monthly_revenue_goal', '5000', 'number', 'Objectif de revenu mensuel ($)'),
  ('monthly_commission_goal', '1500', 'number', 'Objectif de commissions mensuelles ($)'),
  ('monthly_leads_goal', '50', 'number', 'Objectif de leads créés par mois'),
  ('monthly_leads_converted_goal', '10', 'number', 'Objectif de leads convertis par mois'),
  ('monthly_conversion_rate_goal', '40', 'number', 'Objectif taux de conversion (%)'),
  ('monthly_streets_goal', '15', 'number', 'Objectif de rues complétées par mois'),
  ('monthly_doors_goal', '500', 'number', 'Objectif de portes cognées par mois'),
  ('max_router_qty', '1', 'number', 'Quantité max de routeur par commande'),
  ('max_borne_qty', '3', 'number', 'Quantité max de bornes Wi-Fi par commande'),
  ('max_terminal_qty', '5', 'number', 'Quantité max de terminaux TV par commande'),
  ('max_sim_qty', '5', 'number', 'Quantité max de SIM par commande'),
  ('preauth_discount_amount', '5', 'number', 'Rabais pré-autorisation mensuel ($)')
ON CONFLICT (config_key) DO NOTHING;

-- ═══ Seed Quebec coverage ═══
INSERT INTO public.service_coverage_areas (postal_prefix, coverage_type, available_services, notes) VALUES
  ('H1A', 'full', '["internet","tv","mobile"]', NULL),
  ('H1B', 'full', '["internet","tv","mobile"]', NULL),
  ('H1C', 'full', '["internet","tv","mobile"]', NULL),
  ('H1E', 'full', '["internet","tv","mobile"]', NULL),
  ('H1G', 'full', '["internet","tv","mobile"]', NULL),
  ('H1H', 'full', '["internet","tv","mobile"]', NULL),
  ('H1J', 'full', '["internet","tv","mobile"]', NULL),
  ('H1K', 'full', '["internet","tv","mobile"]', NULL),
  ('H1L', 'full', '["internet","tv","mobile"]', NULL),
  ('H1M', 'full', '["internet","tv","mobile"]', NULL),
  ('H1N', 'full', '["internet","tv","mobile"]', NULL),
  ('H1P', 'full', '["internet","tv","mobile"]', NULL),
  ('H1R', 'full', '["internet","tv","mobile"]', NULL),
  ('H1S', 'full', '["internet","tv","mobile"]', NULL),
  ('H1T', 'full', '["internet","tv","mobile"]', NULL),
  ('H1V', 'full', '["internet","tv","mobile"]', NULL),
  ('H1W', 'full', '["internet","tv","mobile"]', NULL),
  ('H1X', 'full', '["internet","tv","mobile"]', NULL),
  ('H1Y', 'full', '["internet","tv","mobile"]', NULL),
  ('H1Z', 'full', '["internet","tv","mobile"]', NULL),
  ('H2A', 'full', '["internet","tv","mobile"]', NULL),
  ('H2B', 'full', '["internet","tv","mobile"]', NULL),
  ('H2C', 'full', '["internet","tv","mobile"]', NULL),
  ('H2E', 'full', '["internet","tv","mobile"]', NULL),
  ('H2G', 'full', '["internet","tv","mobile"]', NULL),
  ('H2H', 'full', '["internet","tv","mobile"]', NULL),
  ('H2J', 'full', '["internet","tv","mobile"]', NULL),
  ('H2K', 'full', '["internet","tv","mobile"]', NULL),
  ('H2L', 'full', '["internet","tv","mobile"]', NULL),
  ('H2M', 'full', '["internet","tv","mobile"]', NULL),
  ('H2N', 'full', '["internet","tv","mobile"]', NULL),
  ('H2P', 'full', '["internet","tv","mobile"]', NULL),
  ('H2R', 'full', '["internet","tv","mobile"]', NULL),
  ('H2S', 'full', '["internet","tv","mobile"]', NULL),
  ('H2T', 'full', '["internet","tv","mobile"]', NULL),
  ('H2V', 'full', '["internet","tv","mobile"]', NULL),
  ('H2W', 'full', '["internet","tv","mobile"]', NULL),
  ('H2X', 'full', '["internet","tv","mobile"]', NULL),
  ('H2Y', 'full', '["internet","tv","mobile"]', NULL),
  ('H2Z', 'full', '["internet","tv","mobile"]', NULL),
  ('H3A', 'full', '["internet","tv","mobile"]', NULL),
  ('H3B', 'full', '["internet","tv","mobile"]', NULL),
  ('H3C', 'full', '["internet","tv","mobile"]', NULL),
  ('H3E', 'full', '["internet","tv","mobile"]', NULL),
  ('H3G', 'full', '["internet","tv","mobile"]', NULL),
  ('H3H', 'full', '["internet","tv","mobile"]', NULL),
  ('H3J', 'full', '["internet","tv","mobile"]', NULL),
  ('H3K', 'full', '["internet","tv","mobile"]', NULL),
  ('H3L', 'full', '["internet","tv","mobile"]', NULL),
  ('H3M', 'full', '["internet","tv","mobile"]', NULL),
  ('H3N', 'full', '["internet","tv","mobile"]', NULL),
  ('H3P', 'full', '["internet","tv","mobile"]', NULL),
  ('H3R', 'full', '["internet","tv","mobile"]', NULL),
  ('H3S', 'full', '["internet","tv","mobile"]', NULL),
  ('H3T', 'full', '["internet","tv","mobile"]', NULL),
  ('H3V', 'full', '["internet","tv","mobile"]', NULL),
  ('H3W', 'full', '["internet","tv","mobile"]', NULL),
  ('H3X', 'full', '["internet","tv","mobile"]', NULL),
  ('H3Y', 'full', '["internet","tv","mobile"]', NULL),
  ('H3Z', 'full', '["internet","tv","mobile"]', NULL),
  ('H4A', 'full', '["internet","tv","mobile"]', NULL),
  ('H4B', 'full', '["internet","tv","mobile"]', NULL),
  ('H4C', 'full', '["internet","tv","mobile"]', NULL),
  ('H4E', 'full', '["internet","tv","mobile"]', NULL),
  ('H4G', 'full', '["internet","tv","mobile"]', NULL),
  ('H4H', 'full', '["internet","tv","mobile"]', NULL),
  ('H4J', 'full', '["internet","tv","mobile"]', NULL),
  ('H4K', 'full', '["internet","tv","mobile"]', NULL),
  ('H4L', 'full', '["internet","tv","mobile"]', NULL),
  ('H4M', 'full', '["internet","tv","mobile"]', NULL),
  ('H4N', 'full', '["internet","tv","mobile"]', NULL),
  ('H4P', 'full', '["internet","tv","mobile"]', NULL),
  ('H4R', 'full', '["internet","tv","mobile"]', NULL),
  ('H4S', 'full', '["internet","tv","mobile"]', NULL),
  ('H4T', 'full', '["internet","tv","mobile"]', NULL),
  ('H4V', 'full', '["internet","tv","mobile"]', NULL),
  ('H4W', 'full', '["internet","tv","mobile"]', NULL),
  ('H4X', 'full', '["internet","tv","mobile"]', NULL),
  ('H4Y', 'full', '["internet","tv","mobile"]', NULL),
  ('H4Z', 'full', '["internet","tv","mobile"]', NULL),
  ('J4B', 'full', '["internet","tv","mobile"]', 'Longueuil/Brossard'),
  ('J4G', 'full', '["internet","tv","mobile"]', 'Longueuil'),
  ('J4H', 'full', '["internet","tv","mobile"]', 'Longueuil'),
  ('J4J', 'full', '["internet","tv","mobile"]', 'Longueuil'),
  ('J4K', 'full', '["internet","tv","mobile"]', 'Longueuil'),
  ('J4L', 'full', '["internet","tv","mobile"]', 'Longueuil'),
  ('J4M', 'full', '["internet","tv","mobile"]', 'Longueuil'),
  ('J4N', 'full', '["internet","tv","mobile"]', 'Longueuil'),
  ('J4P', 'full', '["internet","tv","mobile"]', 'Longueuil'),
  ('J4R', 'full', '["internet","tv","mobile"]', 'Longueuil'),
  ('J4T', 'full', '["internet","tv","mobile"]', 'Brossard'),
  ('J4W', 'full', '["internet","tv","mobile"]', 'Brossard'),
  ('J4X', 'full', '["internet","tv","mobile"]', 'Brossard'),
  ('J4Y', 'full', '["internet","tv","mobile"]', 'Brossard'),
  ('J4Z', 'full', '["internet","tv","mobile"]', 'Brossard'),
  ('H7A', 'limited', '["internet","mobile"]', 'Laval — TV en expansion'),
  ('H7B', 'limited', '["internet","mobile"]', 'Laval — TV en expansion'),
  ('H7C', 'limited', '["internet","mobile"]', 'Laval — TV en expansion'),
  ('H7E', 'limited', '["internet","mobile"]', 'Laval — TV en expansion'),
  ('H7G', 'limited', '["internet","mobile"]', 'Laval — TV en expansion'),
  ('H7H', 'limited', '["internet","mobile"]', 'Laval — TV en expansion'),
  ('H7K', 'limited', '["internet","mobile"]', 'Laval — TV en expansion'),
  ('H7L', 'limited', '["internet","mobile"]', 'Laval — TV en expansion'),
  ('H7M', 'limited', '["internet","mobile"]', 'Laval — TV en expansion'),
  ('H7N', 'limited', '["internet","mobile"]', 'Laval — TV en expansion'),
  ('H7P', 'limited', '["internet","mobile"]', 'Laval — TV en expansion'),
  ('H7R', 'limited', '["internet","mobile"]', 'Laval — TV en expansion'),
  ('H7S', 'limited', '["internet","mobile"]', 'Laval — TV en expansion'),
  ('H7T', 'limited', '["internet","mobile"]', 'Laval — TV en expansion'),
  ('H7V', 'limited', '["internet","mobile"]', 'Laval — TV en expansion'),
  ('H7W', 'limited', '["internet","mobile"]', 'Laval — TV en expansion'),
  ('H7X', 'limited', '["internet","mobile"]', 'Laval — TV en expansion')
ON CONFLICT (postal_prefix) DO NOTHING;