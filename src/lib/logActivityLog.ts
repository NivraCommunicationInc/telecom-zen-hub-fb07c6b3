/**
 * logActivityLog — canonical wrapper for activity_logs writes.
 * Module 44 — single-door migration of 39 direct INSERT sites.
 *
 * Deterministic event_key: `alog:{entity_type}:{entity_id|none}:{action}:{minuteBucket}`
 * Visibility default = "staff" (internal Core/admin operations).
 * Callers dealing with client-facing events (portal timeline) MUST pass
 * visibility: "client". Sensitive events (fraud/security/kyc) MUST pass "admin".
 */
import { writeAccountJournal, type AccountJournalVisibility } from "@/lib/writeAccountJournal";

function minuteBucket(): string {
  return new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
}

export interface ActivityLogInput {
  user_id?: string | null;
  entity_id?: string | null;
  entity_type: string;
  action: string;
  actor_name?: string | null;
  actor_role?: string | null;
  details?: Record<string, unknown> | null;
  changed_field?: string | null;
  reason?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  /** Optional correlation id to link to a parent business event. */
  correlationId?: string | null;
  /** Explicit visibility (defaults to "staff"). */
  visibility?: AccountJournalVisibility;
}

export async function logActivityLog(input: ActivityLogInput) {
  const { visibility = "staff", correlationId = null, ...rest } = input;
  const entityKey = rest.entity_id ?? "none";
  const actionKey = String(rest.action ?? "unknown").slice(0, 80).replace(/\s+/g, "_");
  const eventKey = `alog:${rest.entity_type}:${entityKey}:${actionKey}:${minuteBucket()}`.slice(0, 240);
  return writeAccountJournal({
    targetTable: "activity_logs",
    eventKey,
    correlationId,
    payload: rest as Record<string, unknown>,
    visibility,
  });
}
