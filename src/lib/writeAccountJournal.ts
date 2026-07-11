/**
 * Canonical account journal gateway wrapper (frontend)
 * ----------------------------------------------------
 * Module 41 — Phase B.1
 *
 * SINGLE DOOR: all writes to the notes / activity / follow-up ecosystem
 * from the frontend MUST go through this wrapper. Direct inserts into
 * the 6 core tables below are audited and will be blocked once
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
 *   note     : `note:{client_id}:{note_type}:{yyyymmddhhmm}`  (minute granularity from server ts)
 *   followup : `followup:{account_id}:{category}:{due_date}`
 *
 * Usage:
 *   import { writeAccountJournal } from "@/lib/writeAccountJournal";
 *
 *   await writeAccountJournal({
 *     targetTable: "client_internal_notes",
 *     eventKey: `note:${clientId}:general:${nowMinuteBucket}`,
 *     payload: { client_id: clientId, note_type: "general", body: "..." },
 *   });
 */

import { supabase } from "@/integrations/supabase/client";

export type AccountJournalTable =
  | "client_activity_logs"
  | "activity_logs"
  | "client_internal_notes"
  | "account_followups"
  | "order_status_history"
  | "order_internal_notes";

export type AccountJournalVisibility = "client" | "staff" | "admin";

export interface WriteAccountJournalInput {
  targetTable: AccountJournalTable;
  payload: Record<string, unknown>;
  eventKey: string;
  correlationId?: string | null;
  /**
   * Module 44 visibility contract:
   *   - "client" : event surfaces in the client portal timeline
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
  // Reject obvious random UUIDs used as the entire key.
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRe.test(eventKey)) {
    throw new Error("writeAccountJournal: eventKey must be deterministic, not a bare UUID");
  }
}

const DEFAULT_VISIBILITY: Record<AccountJournalTable, AccountJournalVisibility> = {
  client_activity_logs: "client",
  activity_logs: "admin",
  client_internal_notes: "staff",
  account_followups: "staff",
  order_status_history: "client",
  order_internal_notes: "staff",
};

export async function writeAccountJournal(
  input: WriteAccountJournalInput,
): Promise<WriteAccountJournalResult> {
  if (!ALLOWED_TABLES.has(input.targetTable)) {
    throw new Error(`writeAccountJournal: target_table ${input.targetTable} is not allowed`);
  }
  assertDeterministicEventKey(input.eventKey);

  const visibility = input.visibility ?? DEFAULT_VISIBILITY[input.targetTable];
  const payload: Record<string, unknown> = { ...(input.payload ?? {}), visibility };

  const { data, error } = await supabase.rpc("rpc_account_journal_write", {
    p_target_table: input.targetTable,
    p_payload: payload,
    p_event_key: input.eventKey,
    p_correlation_id: input.correlationId ?? null,
  });

  if (error) {
    // Preserve original error surface for callers already handling business errors.
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
