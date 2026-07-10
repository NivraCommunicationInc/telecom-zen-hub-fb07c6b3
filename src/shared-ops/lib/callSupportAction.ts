/**
 * callSupportAction — canonical frontend gateway to the `support-account-actions`
 * Edge Function. Every write to support_tickets / ticket_replies / ticket_participants
 * from staff UI must go through here. Direct table writes are blocked at the DB
 * level by INVARIANT-TICKET-SINGLE-DOOR triggers.
 *
 * Module 35 — Wave 1 (staff / core portals).
 */
import { supabase } from "@/integrations/supabase/client";

export type SupportAction =
  | "create_ticket"
  | "reply_ticket"
  | "transition_status"
  | "resolve" | "close" | "reopen" | "cancel"
  | "add_participant"
  | "assign_ticket"
  | "update_ticket_meta"
  | "enqueue_ticket_notification";

export interface SupportActionResult {
  ok: boolean;
  ticket_id?: string;
  ticket_number?: string;
  reply_id?: string;
  participant_id?: string;
  inserted?: number;
  error?: string;
  [k: string]: unknown;
}

export async function callSupportAction(
  action: SupportAction,
  payload: Record<string, unknown> = {},
  client?: { functions: { invoke: (name: string, opts: { body: unknown }) => Promise<{ data: unknown; error: unknown }> } },
): Promise<SupportActionResult> {
  const c = client ?? supabase;
  const { data, error } = await c.functions.invoke("support-account-actions", {
    body: { action, ...payload },
  });
  if (error) {
    const msg = (error as { message?: string })?.message ?? "support_action_failed";
    throw new Error(msg);
  }
  const res = (data ?? {}) as SupportActionResult;
  if (res.error) throw new Error(String(res.error));
  return res;
}
