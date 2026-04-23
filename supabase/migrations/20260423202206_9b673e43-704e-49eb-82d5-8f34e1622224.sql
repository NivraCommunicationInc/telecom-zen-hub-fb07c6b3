-- ============================================================================
-- PART 1 — AGENT DISCOUNTS CATALOG (Field Sales)
-- ============================================================================

-- 1) Catalog of discounts
CREATE TABLE IF NOT EXISTS public.agent_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('fixed', 'percentage')),
  value NUMERIC(10,2) NOT NULL CHECK (value > 0),
  applies_to TEXT NOT NULL DEFAULT 'all' CHECK (applies_to IN ('internet', 'tv', 'mobile', 'bundle', 'all')),
  max_uses INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  max_uses_per_agent INTEGER,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_discounts_active ON public.agent_discounts(is_active, expires_at);

-- 2) Assignments — link discounts to agents, roles, or everyone
CREATE TABLE IF NOT EXISTS public.agent_discount_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_id UUID NOT NULL REFERENCES public.agent_discounts(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT,
  applies_to_all BOOLEAN NOT NULL DEFAULT false,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT assignment_target_chk CHECK (
    (agent_id IS NOT NULL)::int + (role IS NOT NULL)::int + (applies_to_all = true)::int = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_agent_disc_assign_agent ON public.agent_discount_assignments(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_disc_assign_role ON public.agent_discount_assignments(role);
CREATE INDEX IF NOT EXISTS idx_agent_disc_assign_all ON public.agent_discount_assignments(applies_to_all) WHERE applies_to_all = true;
CREATE INDEX IF NOT EXISTS idx_agent_disc_assign_discount ON public.agent_discount_assignments(discount_id);

-- 3) updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_agent_discounts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_touch_agent_discounts ON public.agent_discounts;
CREATE TRIGGER trg_touch_agent_discounts
BEFORE UPDATE ON public.agent_discounts
FOR EACH ROW EXECUTE FUNCTION public.touch_agent_discounts_updated_at();

-- 4) RLS
ALTER TABLE public.agent_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_discount_assignments ENABLE ROW LEVEL SECURITY;

-- Admins manage everything
CREATE POLICY "Admins manage agent_discounts"
ON public.agent_discounts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage agent_discount_assignments"
ON public.agent_discount_assignments
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Agents can read discounts assigned to them
CREATE POLICY "Agents read assigned discounts"
ON public.agent_discounts
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND (expires_at IS NULL OR expires_at > now())
  AND EXISTS (
    SELECT 1 FROM public.agent_discount_assignments a
    WHERE a.discount_id = agent_discounts.id
      AND (
        a.applies_to_all = true
        OR a.agent_id = auth.uid()
        OR (a.role IS NOT NULL AND public.has_role(auth.uid(), a.role::app_role))
      )
  )
);

CREATE POLICY "Agents read own assignments"
ON public.agent_discount_assignments
FOR SELECT
TO authenticated
USING (
  applies_to_all = true
  OR agent_id = auth.uid()
  OR (role IS NOT NULL AND public.has_role(auth.uid(), role::app_role))
);

-- 5) Helper RPC: live list of usable discounts for an agent
CREATE OR REPLACE FUNCTION public.get_agent_available_discounts(p_agent_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  type TEXT,
  value NUMERIC,
  applies_to TEXT,
  expires_at TIMESTAMPTZ,
  uses_remaining INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    d.id,
    d.name,
    d.description,
    d.type,
    d.value,
    d.applies_to,
    d.expires_at,
    CASE WHEN d.max_uses IS NULL THEN NULL ELSE GREATEST(0, d.max_uses - d.uses_count) END
  FROM public.agent_discounts d
  WHERE d.is_active = true
    AND (d.expires_at IS NULL OR d.expires_at > now())
    AND (d.max_uses IS NULL OR d.uses_count < d.max_uses)
    AND EXISTS (
      SELECT 1 FROM public.agent_discount_assignments a
      WHERE a.discount_id = d.id
        AND (
          a.applies_to_all = true
          OR a.agent_id = p_agent_id
          OR (a.role IS NOT NULL AND public.has_role(p_agent_id, a.role::app_role))
        )
    )
  ORDER BY d.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_available_discounts(UUID) TO authenticated;