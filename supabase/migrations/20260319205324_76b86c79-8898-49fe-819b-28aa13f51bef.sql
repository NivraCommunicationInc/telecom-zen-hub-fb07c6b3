
-- ============================================
-- Nivra Field Portal — Database Schema
-- ============================================

-- 1. Field Leads
CREATE TABLE public.field_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  agent_name text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','submitted','won','lost')),
  -- Customer info
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  -- Address
  address text,
  city text,
  postal_code text,
  province text DEFAULT 'QC',
  -- Qualification
  service_need text,
  eligibility_notes text,
  payment_method_intent text,
  notes text,
  -- Tracking
  order_id uuid,
  lost_reason text,
  submitted_at timestamptz,
  won_at timestamptz,
  lost_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.field_leads ENABLE ROW LEVEL SECURITY;

-- Agents can only see their own leads
CREATE POLICY "Agents read own leads" ON public.field_leads
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Agents insert own leads" ON public.field_leads
  FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents update own leads" ON public.field_leads
  FOR UPDATE TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- Staff with employee access can see all leads (for supervision)
CREATE POLICY "Staff read all leads" ON public.field_leads
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND status = 'active'
      AND is_active = true
      AND (can_access_core = true OR can_access_employee = true)
    )
  );

-- 2. Field Commissions
CREATE TABLE public.field_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  lead_id uuid REFERENCES public.field_leads(id) ON DELETE SET NULL,
  order_id uuid,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','clawback')),
  approved_at timestamptz,
  approved_by uuid,
  paid_at timestamptz,
  clawback_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.field_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents read own commissions" ON public.field_commissions
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Staff read all commissions" ON public.field_commissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND status = 'active'
      AND is_active = true
      AND (can_access_core = true OR can_access_employee = true)
    )
  );

-- Indexes
CREATE INDEX idx_field_leads_agent ON public.field_leads(agent_id, status);
CREATE INDEX idx_field_leads_status ON public.field_leads(status) WHERE status NOT IN ('won','lost');
CREATE INDEX idx_field_commissions_agent ON public.field_commissions(agent_id, status);
