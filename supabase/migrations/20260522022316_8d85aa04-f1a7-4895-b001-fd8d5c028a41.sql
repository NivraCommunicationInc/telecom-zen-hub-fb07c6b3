-- NOVA Digital Brain — Phase 1 foundation
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.nova_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_type TEXT NOT NULL CHECK (memory_type IN ('company','personal_oldo','contextual','learned','decision','market','agent_insight')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  importance INTEGER DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  embedding vector(1536),
  source TEXT,
  is_active BOOLEAN DEFAULT true,
  last_accessed TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nova_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  messages JSONB DEFAULT '[]',
  context_snapshot JSONB DEFAULT '{}',
  actions_taken JSONB DEFAULT '[]',
  created_by UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nova_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.nova_conversations(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('send_email','launch_campaign','control_agent','modify_crm','generate_report','send_alert','create_ticket','modify_account','assign_lead','schedule_task')),
  action_payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','executing','completed','failed')),
  result JSONB,
  requires_approval BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES public.profiles(user_id),
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nova_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  situation TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  decision_made TEXT NOT NULL,
  reasoning TEXT,
  outcome TEXT,
  made_by TEXT DEFAULT 'oldo',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: admin-only access
ALTER TABLE public.nova_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nova_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nova_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nova_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nova_memory_admin_all" ON public.nova_memory FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "nova_conversations_admin_all" ON public.nova_conversations FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "nova_actions_admin_all" ON public.nova_actions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "nova_decisions_admin_all" ON public.nova_decisions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Updated_at trigger
CREATE TRIGGER nova_memory_updated_at BEFORE UPDATE ON public.nova_memory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER nova_conversations_updated_at BEFORE UPDATE ON public.nova_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Context function for NOVA
CREATE OR REPLACE FUNCTION public.get_nova_context()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ctx JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  SELECT jsonb_build_object(
    'mrr', COALESCE((SELECT SUM(plan_price) FROM billing_subscriptions WHERE status='active'),0),
    'active_clients', (SELECT COUNT(*) FROM accounts WHERE status='active'),
    'new_clients_month', (SELECT COUNT(*) FROM accounts WHERE status='active' AND created_at > date_trunc('month', now())),
    'open_complaints', (SELECT COUNT(*) FROM complaints WHERE status NOT IN ('resolved','closed')),
    'sla_at_risk', (SELECT COUNT(*) FROM complaints WHERE sla_deadline < now() AND status NOT IN ('resolved','closed')),
    'dlq_emails', (SELECT COUNT(*) FROM email_queue WHERE status='dlq'),
    'pending_orders', (SELECT COUNT(*) FROM orders WHERE status='pending'),
    'agents_active', (SELECT COUNT(*) FROM agent_registry WHERE status='active'),
    'crm_hot_leads', (SELECT COUNT(*) FROM crm_contacts WHERE call_status NOT IN ('sold','not_interested','do_not_call') AND priority > 70),
    'top_agent', (SELECT p.full_name FROM sales_commissions sc JOIN profiles p ON p.user_id=sc.salesperson_id WHERE sc.created_at > date_trunc('month', now()) GROUP BY p.full_name ORDER BY SUM(sc.commission_amount) DESC LIMIT 1),
    'revenue_this_month', COALESCE((SELECT SUM(commission_amount) FROM sales_commissions WHERE created_at > date_trunc('month', now())),0),
    'timestamp', to_char(now(),'DD/MM/YYYY HH24:MI')
  ) INTO ctx;
  RETURN ctx;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_nova_context() TO authenticated;

-- Seed company memory
INSERT INTO public.nova_memory (memory_type, category, title, content, importance) VALUES
('company','identity','Identité Nivra Telecom','Nivra Telecom est un fournisseur Internet et TV prépayé au Québec. Fondé par Oldo Lavaud. Sans contrat, sans vérification de crédit, sans frais cachés. Concurrent direct de Bell, Vidéotron et Fizz. Opère principalement à Montréal, Laval et environs.',10),
('company','pricing','Prix et forfaits officiels','Internet 100 Mbps: 45$/mois. Internet 500 Mbps: 50$/mois. Internet GIGA 940 Mbps: 60$/mois. Bundle GIGA + TV 25 choix: 100$/mois. Mobile 50 Go: 50$/mois. Mobile 75 Go: 60$/mois. Borne WiFi: 60$ achat unique. Terminal TV 4K: 50$ achat unique. Taxes: TPS 5% + TVQ 9.975%. PayPal uniquement.',10),
('company','commissions','Structure commissions agents','Internet: 30% du mensuel. TV: 30% du mensuel. Bundle: 30% du mensuel. Équipement: 5%. Mobile: 0%. Superviseur: Marvens.',9),
('company','rules','Règles opérationnelles','Maximum 1 borne WiFi par adresse. Maximum 4 terminaux TV. Maximum 3 services actifs. Rapport quotidien agents avant 21h. Délai rétractation client: 10 jours (LPC Québec). Frais réactivation: 15$. Suspension à J+3 non-paiement.',9),
('company','competition','Analyse concurrence','Bell: contrats 24 mois, vérification crédit, résiliation 200-400$, prix 95-115$/mois Internet. Vidéotron: contrats 24 mois, prix 80-100$/mois. Fizz: prépayé mais vérification crédit, moins de support. Avantage Nivra: vrai prépayé, aucun contrat, aucune vérification crédit, support local québécois.',9),
('personal_oldo','style','Style décisionnel Oldo','Oldo est direct, orienté résultats, impatient avec les erreurs répétées. Il veut du professionnel niveau enterprise. Pas de solutions de base. Toujours la meilleure version possible. Il veut des preuves concrètes pas des résumés. Il pense business en permanence et veut scale rapidement.',10),
('personal_oldo','priorities','Priorités business Oldo','Augmenter MRR rapidement. Recruter et former des agents performants. Automatiser le maximum. Battre Bell et Vidéotron sur le service client. Avoir un système enterprise-level. Expansion territoriale Québec.',10),
('market','quebec_telecom','Marché télécom Québec','Marché dominé par Bell et Vidéotron. Les consommateurs sont fatigués des contrats et des augmentations de prix. Fort potentiel pour le prépayé. Communautés d''immigration importantes à Montréal: clientèle cible sans historique de crédit. Zones à fort potentiel: Montréal-Nord, Saint-Léonard, Laval, Anjou, Repentigny.',8)
ON CONFLICT DO NOTHING;