
CREATE TABLE IF NOT EXISTS public.crm_assignment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  from_agent_id uuid,
  to_agent_id uuid,
  changed_by uuid,
  changed_by_name text,
  reason text,
  kind text NOT NULL DEFAULT 'assign',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_assignment_history_contact ON public.crm_assignment_history(contact_id, created_at DESC);
ALTER TABLE public.crm_assignment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read assignment history" ON public.crm_assignment_history;
CREATE POLICY "Staff can read assignment history" ON public.crm_assignment_history
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role) OR
    has_role(auth.uid(),'employee'::app_role) OR
    has_role(auth.uid(),'field_sales'::app_role) OR
    has_role(auth.uid(),'supervisor'::app_role) OR
    has_role(auth.uid(),'sales'::app_role)
  );

CREATE TABLE IF NOT EXISTS public.crm_agent_status (
  agent_id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'available',
  status_reason text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_agent_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agents read all statuses" ON public.crm_agent_status;
CREATE POLICY "Agents read all statuses" ON public.crm_agent_status
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Agents update own status" ON public.crm_agent_status;
CREATE POLICY "Agents update own status" ON public.crm_agent_status
  FOR ALL TO authenticated USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.crm_agent_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  calls_target integer NOT NULL DEFAULT 20,
  sales_target integer NOT NULL DEFAULT 3,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, effective_from)
);
ALTER TABLE public.crm_agent_quotas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff read quotas" ON public.crm_agent_quotas;
CREATE POLICY "Staff read quotas" ON public.crm_agent_quotas
  FOR SELECT TO authenticated USING (
    agent_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'supervisor'::app_role)
  );
DROP POLICY IF EXISTS "Admins manage quotas" ON public.crm_agent_quotas;
CREATE POLICY "Admins manage quotas" ON public.crm_agent_quotas
  FOR ALL TO authenticated USING (
    has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'supervisor'::app_role)
  ) WITH CHECK (
    has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'supervisor'::app_role)
  );

CREATE OR REPLACE FUNCTION public.crm_log_assignment_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_name text;
  v_kind text;
BEGIN
  IF COALESCE(OLD.assigned_to::text,'') = COALESCE(NEW.assigned_to::text,'') THEN RETURN NEW; END IF;
  SELECT full_name INTO v_name FROM public.profiles WHERE user_id = v_actor LIMIT 1;
  v_kind := CASE WHEN OLD.assigned_to IS NULL THEN 'assign'
                 WHEN NEW.assigned_to IS NULL THEN 'unassign'
                 ELSE 'transfer' END;
  INSERT INTO public.crm_assignment_history(contact_id, from_agent_id, to_agent_id, changed_by, changed_by_name, kind)
  VALUES (NEW.id, OLD.assigned_to, NEW.assigned_to, v_actor, v_name, v_kind);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_crm_assignment_log ON public.crm_contacts;
CREATE TRIGGER trg_crm_assignment_log
  AFTER UPDATE OF assigned_to ON public.crm_contacts
  FOR EACH ROW EXECUTE FUNCTION public.crm_log_assignment_change();

CREATE OR REPLACE FUNCTION public.crm_transfer_contact(
  p_contact_id uuid, p_to_agent_id uuid, p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_old uuid;
BEGIN
  IF v_actor IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_authenticated'); END IF;
  IF p_to_agent_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','missing_agent'); END IF;
  SELECT assigned_to INTO v_old FROM public.crm_contacts WHERE id = p_contact_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','contact_not_found'); END IF;
  IF NOT (
    has_role(v_actor,'admin'::app_role) OR has_role(v_actor,'supervisor'::app_role) OR v_old = v_actor
  ) THEN
    RETURN jsonb_build_object('ok',false,'error','forbidden');
  END IF;
  UPDATE public.crm_contacts
    SET assigned_to = p_to_agent_id,
        is_locked = false, locked_by = NULL, locked_until = NULL, locked_by_name = NULL,
        updated_at = now()
    WHERE id = p_contact_id;
  UPDATE public.crm_assignment_history
    SET reason = p_reason, kind = 'transfer'
    WHERE id = (SELECT id FROM public.crm_assignment_history WHERE contact_id = p_contact_id ORDER BY created_at DESC LIMIT 1);
  RETURN jsonb_build_object('ok',true);
END; $$;

CREATE OR REPLACE FUNCTION public.crm_set_agent_status(
  p_status text, p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_authenticated'); END IF;
  IF p_status NOT IN ('available','break','dnd','offline') THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_status');
  END IF;
  INSERT INTO public.crm_agent_status(agent_id, status, status_reason, updated_at)
  VALUES (v_actor, p_status, p_reason, now())
  ON CONFLICT (agent_id) DO UPDATE
    SET status = EXCLUDED.status, status_reason = EXCLUDED.status_reason, updated_at = now();
  IF p_status IN ('break','dnd','offline') THEN
    UPDATE public.crm_contacts
      SET is_locked = false, locked_by = NULL, locked_until = NULL, locked_by_name = NULL
      WHERE locked_by = v_actor;
  END IF;
  RETURN jsonb_build_object('ok',true,'status',p_status);
END; $$;

CREATE OR REPLACE FUNCTION public.crm_my_quota_progress()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_calls_target int := 20;
  v_sales_target int := 3;
  v_calls int := 0;
  v_sales int := 0;
BEGIN
  IF v_actor IS NULL THEN RETURN jsonb_build_object('ok',false); END IF;
  SELECT calls_target, sales_target INTO v_calls_target, v_sales_target
    FROM public.crm_agent_quotas
    WHERE agent_id = v_actor AND effective_from <= CURRENT_DATE
    ORDER BY effective_from DESC LIMIT 1;
  SELECT COUNT(*) INTO v_calls FROM public.crm_call_logs
    WHERE agent_id = v_actor AND started_at::date = CURRENT_DATE;
  SELECT COUNT(*) INTO v_sales FROM public.crm_call_logs
    WHERE agent_id = v_actor AND outcome = 'sold' AND started_at::date = CURRENT_DATE;
  RETURN jsonb_build_object(
    'ok', true,
    'calls', v_calls, 'calls_target', COALESCE(v_calls_target,20),
    'sales', v_sales, 'sales_target', COALESCE(v_sales_target,3)
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.crm_transfer_contact(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_set_agent_status(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_my_quota_progress() TO authenticated;
