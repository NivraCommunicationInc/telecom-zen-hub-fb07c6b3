-- ═══════════════════════════════════════════════════════════════════
-- Fix 1: Auto-deploy equipment when order becomes 'activated'
-- ═══════════════════════════════════════════════════════════════════
-- When an order's status transitions to 'activated', mark all equipment
-- currently linked to that order as 'deployed' (except defective units).
-- Idempotent: only fires on the transition INTO 'activated'.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_auto_deploy_equipment_on_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Only act on transition INTO 'activated'
  IF NEW.status = 'activated' AND (OLD.status IS DISTINCT FROM 'activated') THEN
    UPDATE public.equipment_inventory
       SET status = 'deployed',
           deployed_at = COALESCE(deployed_at, NOW()),
           updated_at = NOW()
     WHERE order_id = NEW.id
       AND status NOT IN ('defective', 'lost', 'deployed', 'returned');

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Audit log entry per affected equipment row
    IF v_count > 0 THEN
      INSERT INTO public.equipment_audit_log (equipment_id, action, old_status, new_status, actor_name, details)
      SELECT id,
             'auto_deployed',
             'assigned',
             'deployed',
             'system_trigger',
             jsonb_build_object('order_id', NEW.id, 'reason', 'order_activated')
        FROM public.equipment_inventory
       WHERE order_id = NEW.id
         AND status = 'deployed'
         AND deployed_at >= NOW() - INTERVAL '5 seconds';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_deploy_equipment ON public.orders;

CREATE TRIGGER trg_auto_deploy_equipment
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_deploy_equipment_on_activation();

-- ═══════════════════════════════════════════════════════════════════
-- Defective equipment notifications table (for in-app admin alerts)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.defective_equipment_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES public.equipment_inventory(id) ON DELETE CASCADE,
  serial_number text,
  catalog_name text,
  category text,
  account_id uuid,
  order_id uuid,
  reported_by uuid,
  reported_by_name text,
  notes text,
  email_sent boolean NOT NULL DEFAULT false,
  email_sent_at timestamptz,
  acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_defective_alerts_unacked
  ON public.defective_equipment_alerts(acknowledged, created_at DESC)
  WHERE acknowledged = false;

ALTER TABLE public.defective_equipment_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read defective alerts" ON public.defective_equipment_alerts;
CREATE POLICY "Admins read defective alerts"
  ON public.defective_equipment_alerts
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'employee'::app_role));

DROP POLICY IF EXISTS "Admins insert defective alerts" ON public.defective_equipment_alerts;
CREATE POLICY "Admins insert defective alerts"
  ON public.defective_equipment_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'employee'::app_role));

DROP POLICY IF EXISTS "Admins update defective alerts" ON public.defective_equipment_alerts;
CREATE POLICY "Admins update defective alerts"
  ON public.defective_equipment_alerts
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));