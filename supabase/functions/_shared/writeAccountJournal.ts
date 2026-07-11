/**
 * Canonical account journal gateway wrapper (edge functions)
 * ----------------------------------------------------------
 * Module 41 — Phase B.1
 *
 * SINGLE DOOR: all edge functions MUST write to the notes / activity /
 * follow-up ecosystem through this wrapper. Direct inserts into the 6
 * core tables listed below are audited and will be blocked once
 * `enforce_single_door=true` is flipped.
 *
 * Allowed target tables:
 *   - client_activity_logs
 *   - activity_logs
 *   - client_internal_notes
 *   - account_followups
 *   - order_status_history
 *   - order_internal_notes
 *
 * Deterministic event keys — REQUIRED. Never use crypto.randomUUID() or
 * Date.now() alone. Recommended patterns per domain:
 *
 *   payment  : `payment:{payment_id}:received`
 *   order    : `order:{order_id}:status:{new_status}`
 *   kyc      : `kyc:{client_id}:approved`
 *   contract : `contract:{contract_id}:signed`
 *   note     : `note:{client_id}:{note_type}:{yyyymmddhhmm}`
 *   followup : `followup:{account_id}:{category}:{due_date}`
 *
 * The `supabase` parameter must be a service-role client so the RPC can
 * run under SECURITY DEFINER without RLS interference.
 */

// deno-lint-ignore no-explicit-any
type SupabaseLike = { rpc: (fn: string, args: Record<string, any>) => Promise<{ data: any; error: any }> };

export type AccountJournalTable =
  | "client_activity_logs"
  | "activity_logs"
  | "client_internal_notes"
  | "account_followups"
  | "order_status_history"
  | "order_internal_notes";

export interface WriteAccountJournalActor {
  userId: string;
  role?: string;
  name?: string;
  email?: string | null;
}

export type AccountJournalVisibility = "client" | "staff" | "admin";

export interface WriteAccountJournalInput {
  targetTable: AccountJournalTable;
  payload: Record<string, unknown>;
  eventKey: string;
  correlationId?: string | null;
  /**
   * Optional actor override. Only honored when the RPC is called under a
   * service_role JWT (Edge Functions). Ignored for authenticated frontend
   * calls (auth.uid() wins). Serialized as `payload._actor` for the RPC.
   */
  actor?: WriteAccountJournalActor | null;
  /**
   * Module 44 visibility contract:
   *   - "client" : surfaces in the client portal timeline
   *   - "staff"  : internal, staff-only
   *   - "admin"  : sensitive (fraud, security, kyc, consent, privacy, docs)
   * Defaults inferred by targetTable when omitted.
   */
  visibility?: AccountJournalVisibility;
}

export interface WriteAccountJournalResult {
  ok: boolean;
  id?: string;
  idempotent?: boolean;
  correlationId?: string;
  eventKey?: string;
  raw: unknown;
}

const ALLOWED_TABLES: ReadonlySet<AccountJournalTable> = new Set([
  "client_activity_logs",
  "activity_logs",
  "client_internal_notes",
  "account_followups",
  "order_status_history",
  "order_internal_notes",
]);

function assertDeterministicEventKey(eventKey: string): void {
  if (!eventKey || typeof eventKey !== "string") {
    throw new Error("writeAccountJournal: eventKey is required and must be a non-empty string");
  }
  if (eventKey.length < 6 || eventKey.length > 240) {
    throw new Error("writeAccountJournal: eventKey must be 6-240 chars");
  }
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRe.test(eventKey)) {
    throw new Error("writeAccountJournal: eventKey must be deterministic, not a bare UUID");
  }
}

export async function writeAccountJournal(
  supabase: SupabaseLike,
  input: WriteAccountJournalInput,
): Promise<WriteAccountJournalResult> {
  if (!ALLOWED_TABLES.has(input.targetTable)) {
    throw new Error(`writeAccountJournal: target_table ${input.targetTable} is not allowed`);
  }
  assertDeterministicEventKey(input.eventKey);

  const DEFAULT_VISIBILITY: Record<AccountJournalTable, AccountJournalVisibility> = {
    client_activity_logs: "client",
    activity_logs: "admin",
    client_internal_notes: "staff",
    account_followups: "staff",
    order_status_history: "client",
    order_internal_notes: "staff",
  };
  const visibility = input.visibility ?? DEFAULT_VISIBILITY[input.targetTable];

  const payload: Record<string, unknown> = { ...(input.payload ?? {}), visibility };
  if (input.actor && input.actor.userId) {
    payload._actor = {
      user_id: input.actor.userId,
      role: input.actor.role ?? "system",
      name: input.actor.name ?? "system",
      email: input.actor.email ?? null,
    };
  }

  const { data, error } = await supabase.rpc("rpc_account_journal_write", {
    p_target_table: input.targetTable,
    p_payload: payload,
    p_event_key: input.eventKey,
    p_correlation_id: input.correlationId ?? null,
  });

  if (error) {
    throw error;
  }

  const raw = data as Record<string, unknown> | null;
  return {
    ok: Boolean(raw?.ok),
    id: (raw?.id as string | undefined) ?? undefined,
    idempotent: Boolean(raw?.idempotent),
    correlationId: (raw?.correlation_id as string | undefined) ?? undefined,
    eventKey: (raw?.event_key as string | undefined) ?? undefined,
    raw,
  };
}
