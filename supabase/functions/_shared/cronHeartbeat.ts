/**
 * cronHeartbeat — non-blocking heartbeat helper for edge functions triggered by pg_cron.
 *
 * Any failure to write a heartbeat is swallowed and logged. It NEVER breaks the
 * caller's business logic — that's the whole point: monitoring must not become
 * a new failure mode.
 *
 * Usage:
 *   await withHeartbeat(supabase, "billing-generate-renewals", async () => {
 *     // ... existing cron logic
 *     return { processed: 42, errors: 0 };
 *   });
 */
type AnyClient = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }> };

export async function recordHeartbeat(
  supabase: AnyClient,
  cronName: string,
  status: "success" | "error",
  startedAt: Date,
  details: Record<string, unknown> = {},
  errorMessage?: string | null,
): Promise<void> {
  try {
    const { error } = await supabase.rpc("record_cron_heartbeat", {
      _cron_name: cronName,
      _status: status,
      _started_at: startedAt.toISOString(),
      _details: details,
      _error_message: errorMessage ?? null,
    });
    if (error) console.warn(`[cronHeartbeat:${cronName}] rpc error:`, error);
  } catch (e) {
    console.warn(`[cronHeartbeat:${cronName}] exception:`, e);
  }
}

export async function withHeartbeat<T>(
  supabase: AnyClient,
  cronName: string,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = new Date();
  try {
    const result = await fn();
    const details = typeof result === "object" && result !== null ? (result as Record<string, unknown>) : { result };
    await recordHeartbeat(supabase, cronName, "success", startedAt, details);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordHeartbeat(supabase, cronName, "error", startedAt, {}, msg);
    throw err;
  }
}
