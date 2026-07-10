
-- ============================================================================
-- Module 36 — Phase A : DB Foundations for Supervisor Escalation
-- ============================================================================

-- 1) Add new columns (all nullable — backward compatible)
ALTER TABLE public.internal_tickets
  ADD COLUMN IF NOT EXISTS account_id uuid,
  ADD COLUMN IF NOT EXISTS client_user_id uuid,
  ADD COLUMN IF NOT EXISTS related_support_ticket_id uuid,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS escalation_type text;

-- 2) Expand CHECK constraints — add 'supervisor' (destination) + 'supervisor','support' (author)
ALTER TABLE public.internal_tickets
  DROP CONSTRAINT IF EXISTS internal_tickets_assigned_to_department_check;
ALTER TABLE public.internal_tickets
  ADD CONSTRAINT internal_tickets_assigned_to_department_check
  CHECK (assigned_to_department = ANY (ARRAY['admin','employee','technician','all','supervisor']));

ALTER TABLE public.internal_tickets
  DROP CONSTRAINT IF EXISTS internal_tickets_created_by_role_check;
ALTER TABLE public.internal_tickets
  ADD CONSTRAINT internal_tickets_created_by_role_check
  CHECK (created_by_role = ANY (ARRAY['admin','employee','technician','supervisor','support']));

-- 3) Idempotency: partial UNIQUE index (only when set) — race-safe
CREATE UNIQUE INDEX IF NOT EXISTS idx_internal_tickets_idempotency_key
  ON public.internal_tickets (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_internal_tickets_account_id
  ON public.internal_tickets (account_id)
  WHERE account_id IS NOT NULL;

-- 4) RLS: supervisors can read/update their escalation queue
DROP POLICY IF EXISTS "Supervisors can view escalation tickets" ON public.internal_tickets;
CREATE POLICY "Supervisors can view escalation tickets"
  ON public.internal_tickets FOR SELECT
  USING (
    has_role(auth.uid(), 'supervisor'::app_role)
    AND (
      assigned_to_department = 'supervisor'
      OR created_by_id = auth.uid()
      OR (cc_departments ? 'supervisor')
    )
  );

DROP POLICY IF EXISTS "Supervisors can update escalation tickets" ON public.internal_tickets;
CREATE POLICY "Supervisors can update escalation tickets"
  ON public.internal_tickets FOR UPDATE
  USING (
    has_role(auth.uid(), 'supervisor'::app_role)
    AND (
      assigned_to_department = 'supervisor'
      OR assigned_to_id = auth.uid()
      OR created_by_id = auth.uid()
    )
  );

-- 5) INVARIANT-ESCALATION-SINGLE-DOOR
-- Scoped strictly to inserts/updates targeting the supervisor channel.
-- Does NOT affect existing flows (operations, employee, technician, admin).
CREATE OR REPLACE FUNCTION public.internal_tickets_escalation_guard_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_ok text;
  v_target text;
BEGIN
  v_target := COALESCE(NEW.assigned_to_department, OLD.assigned_to_department);
  -- Only guard the supervisor channel; leave everything else untouched
  IF v_target IS DISTINCT FROM 'supervisor' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Explicit bypass flag set by canonical edge function
  v_ok := current_setting('app.escalation_write_ok', true);
  IF v_ok = '1' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Service role & superuser bypass (edge functions, migrations, admin ops)
  IF current_setting('role', true) IN ('service_role')
     OR session_user IN ('postgres','supabase_admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  RAISE EXCEPTION
    'INVARIANT-ESCALATION-SINGLE-DOOR: direct % on supervisor channel is forbidden. Route via supervisor-escalation-action.',
    TG_OP
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_internal_tickets_escalation_guard ON public.internal_tickets;
CREATE TRIGGER trg_internal_tickets_escalation_guard
  BEFORE INSERT OR UPDATE ON public.internal_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.internal_tickets_escalation_guard_write();

-- 6) Ensure service_role can bypass RLS on internal_tickets (edge function writes)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_tickets TO service_role;
