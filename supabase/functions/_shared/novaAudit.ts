/**
 * NOVA audit helpers — drop-in logging for the nova-* edge functions.
 *
 * Before this helper, nova-email-handler / nova-memory-update / nova-watchdog
 * ran completely without audit. Decisions made by NOVA on autopilot were
 * impossible to trace after the fact. This module gives them a one-line way
 * to log to `agent_audit_log` (and optionally `agent_events`) without rewriting
 * each function.
 *
 * Usage:
 *
 *   import { withNovaAudit } from "../_shared/novaAudit.ts";
 *
 *   serve(async (req) =>
 *     withNovaAudit("nova-watchdog", "scan", supabase, async () => {
 *       // ... real work ...
 *       return { processed: 12, alerts: 1 };
 *     }, req)
 *   );
 *
 * The wrapper:
 *  - Times the execution
 *  - Catches errors → logs failure + reports to Sentry
 *  - Logs success with the returned summary
 */
import { reportEdgeError } from "./sentry.ts";

type SupabaseClient = {
  from: (table: string) => {
    insert: (data: unknown) => Promise<{ error: unknown }>;
  };
};

export interface NovaAuditOptions {
  /** Also write a row to agent_events with the given event_type. */
  alsoEvent?: "info" | "success" | "warning" | "error" | "critical";
  /** Human-readable message for agent_events (defaults to action name). */
  eventMessage?: string;
}

/**
 * Wrap a Deno.serve handler with audit logging. The handler should return a
 * JSON-serializable summary; that summary lands in agent_audit_log.details.
 *
 * The handler is responsible for OPTIONS + the final Response. We just log.
 */
export async function withNovaAudit<T extends { toJSON?: () => unknown } | Record<string, unknown> | null | undefined>(
  agentName: string,
  action: string,
  supabase: SupabaseClient,
  handler: () => Promise<T>,
  options: NovaAuditOptions = {},
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await handler();
    const durationMs = Date.now() - startedAt;

    // Log success — best-effort, never throws.
    await supabase.from("agent_audit_log").insert({
      agent_name: agentName,
      action,
      result: "success",
      execution_time_ms: durationMs,
      details: result ?? {},
    }).then(() => undefined, (e: unknown) => {
      console.warn(`[${agentName}] audit log failed:`, e);
    });

    if (options.alsoEvent) {
      await supabase.from("agent_events").insert({
        agent_name: agentName,
        event_type: options.alsoEvent,
        message: options.eventMessage ?? `${action} completed in ${durationMs}ms`,
        details: result ?? {},
      }).then(() => undefined, () => undefined);
    }

    return result;
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const msg = err instanceof Error ? err.message : String(err);

    await supabase.from("agent_audit_log").insert({
      agent_name: agentName,
      action,
      result: "failure",
      error_message: msg,
      execution_time_ms: durationMs,
    }).then(() => undefined, () => undefined);

    await supabase.from("agent_events").insert({
      agent_name: agentName,
      event_type: "error",
      message: `${action} failed: ${msg.slice(0, 200)}`,
      details: { error: msg },
    }).then(() => undefined, () => undefined);

    reportEdgeError(err, { function: agentName, action }).catch(() => {});

    throw err; // re-throw so the caller's own try/catch can return the right HTTP code
  }
}

/**
 * Log a single NOVA decision (use inside a handler, between business operations).
 *
 * Example — inside nova-watchdog after raising an alert:
 *
 *   await logNovaDecision(supabase, "nova-watchdog", "raised_alert", {
 *     severity: "critical",
 *     reason: "DLQ exceeded threshold",
 *     dlq_count: 12,
 *   });
 */
export async function logNovaDecision(
  supabase: SupabaseClient,
  agentName: string,
  decisionType: string,
  details: Record<string, unknown>,
): Promise<void> {
  await supabase.from("agent_events").insert({
    agent_name: agentName,
    event_type: "info",
    message: decisionType,
    details,
  }).then(() => undefined, (e: unknown) => {
    console.warn(`[${agentName}] decision log failed:`, e);
  });
}
