
-- 1. New columns on crm_contacts
ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS is_dnc BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dnc_reason TEXT,
  ADD COLUMN IF NOT EXISTS interest_tags TEXT[] NOT NULL DEFAULT '{}';

-- 2. Territories table
CREATE TABLE IF NOT EXISTS public.crm_territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  city TEXT NOT NULL,
  assigned_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_id, city)
);
CREATE INDEX IF NOT EXISTS idx_crm_territories_city ON public.crm_territories (city);
CREATE INDEX IF NOT EXISTS idx_crm_territories_agent ON public.crm_territories (agent_id);

ALTER TABLE public.crm_territories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage territories" ON public.crm_territories;
CREATE POLICY "Admins manage territories" ON public.crm_territories
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Agents view territories" ON public.crm_territories;
CREATE POLICY "Agents view territories" ON public.crm_territories
  FOR SELECT USING (
    auth.uid() = agent_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
    OR public.has_role(auth.uid(), 'field_sales')
  );

-- 3. Optimal hour function (returns label like "18h-20h")
CREATE OR REPLACE FUNCTION public.crm_optimal_hour(p_contact_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  best_hour INT;
BEGIN
  SELECT EXTRACT(HOUR FROM started_at AT TIME ZONE 'America/Toronto')::INT
  INTO best_hour
  FROM public.crm_call_logs
  WHERE contact_id = p_contact_id
    AND outcome IN ('sold', 'callback', 'voicemail')
  GROUP BY 1
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  IF best_hour IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN best_hour::text || 'h-' || (best_hour + 2)::text || 'h';
END $$;

-- 4. Admin assign contact
CREATE OR REPLACE FUNCTION public.crm_assign_contact(p_contact_id UUID, p_agent_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin only');
  END IF;
  UPDATE public.crm_contacts
     SET assigned_to = p_agent_id, updated_at = now()
   WHERE id = p_contact_id;
  RETURN jsonb_build_object('ok', true);
END $$;

-- 5. Set tags
CREATE OR REPLACE FUNCTION public.crm_set_tags(p_contact_id UUID, p_tags TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
    OR public.has_role(auth.uid(), 'field_sales')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  UPDATE public.crm_contacts
     SET interest_tags = COALESCE(p_tags, '{}'),
         updated_at = now()
   WHERE id = p_contact_id;
  RETURN jsonb_build_object('ok', true);
END $$;

-- 6. Mark DNC
CREATE OR REPLACE FUNCTION public.crm_set_dnc(p_contact_id UUID, p_is_dnc BOOLEAN, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'employee')
    OR public.has_role(auth.uid(), 'field_sales')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  UPDATE public.crm_contacts
     SET is_dnc = p_is_dnc,
         dnc_reason = CASE WHEN p_is_dnc THEN p_reason ELSE NULL END,
         call_status = CASE WHEN p_is_dnc THEN 'do_not_call' ELSE call_status END,
         updated_at = now()
   WHERE id = p_contact_id;
  RETURN jsonb_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION public.crm_optimal_hour(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_assign_contact(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_set_tags(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_set_dnc(UUID, BOOLEAN, TEXT) TO authenticated;
