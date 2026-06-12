-- Add SLA tracking columns to support_tickets
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS sla_due_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_breached      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_tier          TEXT;

-- Backfill sla_due_at for existing open tickets
UPDATE public.support_tickets SET
  sla_due_at = CASE
    WHEN priority = 'critical' THEN created_at + INTERVAL '1 hour'
    WHEN priority = 'high'     THEN created_at + INTERVAL '4 hours'
    WHEN priority = 'medium'   THEN created_at + INTERVAL '24 hours'
    ELSE                             created_at + INTERVAL '72 hours'
  END,
  sla_tier = CASE
    WHEN priority = 'critical' THEN 'P1'
    WHEN priority = 'high'     THEN 'P2'
    WHEN priority = 'medium'   THEN 'P3'
    ELSE                             'P4'
  END
WHERE sla_due_at IS NULL AND status NOT IN ('resolved', 'closed', 'cancelled');

-- Mark already-breached tickets
UPDATE public.support_tickets
SET sla_breached = true
WHERE sla_due_at IS NOT NULL
  AND sla_due_at < NOW()
  AND status NOT IN ('resolved', 'closed', 'cancelled');

-- Index for SLA monitoring queries
CREATE INDEX IF NOT EXISTS idx_support_tickets_sla
  ON public.support_tickets (sla_due_at, sla_breached)
  WHERE status NOT IN ('resolved', 'closed', 'cancelled');

-- Trigger: auto-set sla_due_at and sla_tier, auto-flag breaches
CREATE OR REPLACE FUNCTION public.set_ticket_sla()
RETURNS TRIGGER LANGUAGE plpgsql AS $func$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.priority IS DISTINCT FROM OLD.priority) THEN
    NEW.sla_due_at := CASE
      WHEN NEW.priority = 'critical' THEN NEW.created_at + INTERVAL '1 hour'
      WHEN NEW.priority = 'high'     THEN NEW.created_at + INTERVAL '4 hours'
      WHEN NEW.priority = 'medium'   THEN NEW.created_at + INTERVAL '24 hours'
      ELSE                                NEW.created_at + INTERVAL '72 hours'
    END;
    NEW.sla_tier := CASE
      WHEN NEW.priority = 'critical' THEN 'P1'
      WHEN NEW.priority = 'high'     THEN 'P2'
      WHEN NEW.priority = 'medium'   THEN 'P3'
      ELSE                                'P4'
    END;
  END IF;
  IF NEW.sla_due_at IS NOT NULL AND NEW.sla_due_at < NOW()
     AND NEW.status NOT IN ('resolved','closed','cancelled') THEN
    NEW.sla_breached := true;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_ticket_sla ON public.support_tickets;
CREATE TRIGGER trg_ticket_sla
  BEFORE INSERT OR UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_ticket_sla();
