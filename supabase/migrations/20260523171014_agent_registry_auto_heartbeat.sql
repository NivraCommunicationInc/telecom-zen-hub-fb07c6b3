-- ==============================================================================
-- AGENT REGISTRY — Auto-heartbeat from agent_audit_log inserts
-- ==============================================================================
-- Problème résolu:
--   Le supervisor signale `999999min late` pour 10 agents (analytics, billing,
--   crm-optimizer, marketing, recruitment, retention, review-request, sales,
--   site-monitor, support, sync) parce qu'ils ne mettent jamais à jour
--   `agent_registry.last_run_at`. Seuls les 9 agents qui utilisent
--   `_shared/agentHelpers.updateRegistry()` le font correctement.
--
-- Solution:
--   Trigger automatique. Chaque fois qu'un agent insère une ligne dans
--   `agent_audit_log`, on bump `agent_registry.last_run_at` et les compteurs
--   pour ce nom d'agent — peu importe comment l'agent est écrit ou s'il
--   appelle updateRegistry(). Marche AUSSI pour les futurs agents.
--
-- Bonus:
--   - Crée la row dans agent_registry si elle manque (auto-discovery).
--   - Met à jour total_runs, total_successes/failures basé sur `result`.
--   - Reset consecutive_failures à 0 sur succès, incrémente sur échec.
-- ==============================================================================

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
  -- Normalise the audit result into success/failure. Anything not explicitly
  -- "failure" / "error" is treated as success (info / warning / skipped count
  -- as successful executions for heartbeat purposes — the agent ran).
  v_is_success := COALESCE(LOWER(NEW.result), '') NOT IN ('failure', 'error', 'failed');

  -- Upsert so agents that aren't yet registered get a row automatically.
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

DROP TRIGGER IF EXISTS trg_agent_audit_heartbeat ON public.agent_audit_log;
CREATE TRIGGER trg_agent_audit_heartbeat
  AFTER INSERT ON public.agent_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_agent_audit_heartbeat();

-- ──────────────────────────────────────────────────────────────────────────────
-- BACKFILL — derive last_run_at NOW for every agent we've ever heard from,
-- so the supervisor stops crying "999999min late" on its next scan.
-- ──────────────────────────────────────────────────────────────────────────────
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
  0,  -- reset consecutive_failures during backfill
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
  'AGENT_REGISTRY_AUTO_HEARTBEAT',
  'info',
  jsonb_build_object(
    'description', 'Trigger on agent_audit_log INSERT bumps agent_registry.last_run_at automatically',
    'applied_at', now(),
    'fixes', ARRAY[
      'Removes the "999999min late" supervisor noise on 10 agents that did not call updateRegistry()',
      'Auto-discovers new agents (no manual INSERT into agent_registry needed)',
      'Resets consecutive_failures on success'
    ]
  )
);
