-- ==============================================================================
-- AGENT REGISTRY HEARTBEAT — V2 (fixes V1 which failed to apply silently)
-- ==============================================================================
-- The previous migration (20260523171014_agent_registry_auto_heartbeat.sql)
-- used `ON CONFLICT (agent_name) DO UPDATE ...` but agent_registry doesn't
-- have a unique constraint on agent_name, so the migration likely failed
-- silently. This V2:
--   1. Ensures the UNIQUE constraint exists.
--   2. Defines the trigger function (idempotent — uses CREATE OR REPLACE).
--   3. Installs the trigger.
--   4. Backfills last_run_at from existing agent_audit_log.
-- ==============================================================================

-- STEP 1 — Add UNIQUE constraint on agent_name if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'agent_registry'
      AND c.contype = 'u'
      AND EXISTS (
        SELECT 1 FROM unnest(c.conkey) AS k
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
        WHERE a.attname = 'agent_name'
      )
  ) THEN
    -- First, deduplicate any existing rows that share an agent_name so
    -- the constraint can be added without violation.
    WITH ranked AS (
      SELECT id, agent_name,
             ROW_NUMBER() OVER (PARTITION BY agent_name ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) AS rn
      FROM public.agent_registry
    )
    DELETE FROM public.agent_registry
    WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

    ALTER TABLE public.agent_registry
      ADD CONSTRAINT agent_registry_agent_name_key UNIQUE (agent_name);
  END IF;
END$$;

-- STEP 2 — Trigger function (auto-heartbeat from audit log inserts).
CREATE OR REPLACE FUNCTION public.fn_agent_audit_heartbeat()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_success boolean;
  v_now        timestamptz := now();
BEGIN
  v_is_success := COALESCE(LOWER(NEW.result), '') NOT IN ('failure', 'error', 'failed');

  INSERT INTO public.agent_registry (
    agent_name,
    status,
    last_run_at,
    last_success_at,
    last_error_at,
    last_error_message,
    total_runs,
    total_successes,
    total_failures,
    consecutive_failures,
    health_score,
    updated_at
  )
  VALUES (
    NEW.agent_name,
    'active',
    v_now,
    CASE WHEN v_is_success THEN v_now ELSE NULL END,
    CASE WHEN v_is_success THEN NULL ELSE v_now END,
    CASE WHEN v_is_success THEN NULL ELSE NEW.error_message END,
    1,
    CASE WHEN v_is_success THEN 1 ELSE 0 END,
    CASE WHEN v_is_success THEN 0 ELSE 1 END,
    CASE WHEN v_is_success THEN 0 ELSE 1 END,
    100,
    v_now
  )
  ON CONFLICT (agent_name) DO UPDATE SET
    last_run_at     = v_now,
    last_success_at = CASE WHEN v_is_success THEN v_now ELSE agent_registry.last_success_at END,
    last_error_at   = CASE WHEN v_is_success THEN agent_registry.last_error_at ELSE v_now END,
    last_error_message = CASE
      WHEN v_is_success THEN agent_registry.last_error_message
      ELSE COALESCE(NEW.error_message, agent_registry.last_error_message)
    END,
    total_runs       = COALESCE(agent_registry.total_runs, 0) + 1,
    total_successes  = COALESCE(agent_registry.total_successes, 0) + CASE WHEN v_is_success THEN 1 ELSE 0 END,
    total_failures   = COALESCE(agent_registry.total_failures, 0)  + CASE WHEN v_is_success THEN 0 ELSE 1 END,
    consecutive_failures = CASE
      WHEN v_is_success THEN 0
      ELSE COALESCE(agent_registry.consecutive_failures, 0) + 1
    END,
    updated_at       = v_now;

  RETURN NEW;
END;
$$;

-- STEP 3 — Trigger.
DROP TRIGGER IF EXISTS trg_agent_audit_heartbeat ON public.agent_audit_log;
CREATE TRIGGER trg_agent_audit_heartbeat
  AFTER INSERT ON public.agent_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_agent_audit_heartbeat();

-- STEP 4 — Backfill (re-runs safely thanks to UNIQUE + ON CONFLICT).
WITH latest_audits AS (
  SELECT
    agent_name,
    MAX(created_at) AS last_run_at,
    MAX(CASE WHEN COALESCE(LOWER(result), '') NOT IN ('failure', 'error', 'failed') THEN created_at END) AS last_success_at,
    MAX(CASE WHEN COALESCE(LOWER(result), '') IN ('failure', 'error', 'failed') THEN created_at END) AS last_error_at,
    COUNT(*) AS total_runs,
    COUNT(*) FILTER (WHERE COALESCE(LOWER(result), '') NOT IN ('failure', 'error', 'failed')) AS total_successes,
    COUNT(*) FILTER (WHERE COALESCE(LOWER(result), '') IN ('failure', 'error', 'failed')) AS total_failures
  FROM public.agent_audit_log
  GROUP BY agent_name
)
INSERT INTO public.agent_registry (
  agent_name, status, last_run_at, last_success_at, last_error_at,
  total_runs, total_successes, total_failures, consecutive_failures, health_score, updated_at
)
SELECT
  agent_name, 'active', last_run_at, last_success_at, last_error_at,
  total_runs, total_successes, total_failures,
  0,
  GREATEST(0, LEAST(100, 100 - (total_failures::int * 5))),
  now()
FROM latest_audits
ON CONFLICT (agent_name) DO UPDATE SET
  last_run_at = EXCLUDED.last_run_at,
  last_success_at = COALESCE(EXCLUDED.last_success_at, agent_registry.last_success_at),
  last_error_at   = COALESCE(EXCLUDED.last_error_at,   agent_registry.last_error_at),
  total_runs = EXCLUDED.total_runs,
  total_successes = EXCLUDED.total_successes,
  total_failures = EXCLUDED.total_failures,
  consecutive_failures = 0,
  updated_at = now();

-- ──────────────────────────────────────────────────────────────────────────────
-- AUDIT
-- ──────────────────────────────────────────────────────────────────────────────
INSERT INTO public.security_events (event_type, severity, details)
VALUES (
  'AGENT_HEARTBEAT_V2_APPLIED',
  'info',
  jsonb_build_object(
    'description', 'Added UNIQUE constraint, re-applied heartbeat trigger, backfilled last_run_at',
    'applied_at', now()
  )
);
