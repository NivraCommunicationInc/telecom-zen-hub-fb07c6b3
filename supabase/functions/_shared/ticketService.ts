/**
 * ticketService — Canonical server-side ticket operations for Module 35.
 *
 * SINGLE DOOR for support_tickets / ticket_replies / ticket_participants /
 * ticket_attachments. Every producer (Core UI, employee, contact form, chatbot,
 * Nova, support-email-inbound, agent-support, etc.) must go through these
 * helpers. Direct table writes are blocked by DB guard triggers except for
 * service_role SECURITY DEFINER RPCs invoked here.
 *
 * All writes are transactional at the RPC level (DB commits inside the RPC).
 * Email enqueue is best-effort AFTER the RPC succeeds — worker retries handle
 * SMTP failures without rolling back the business operation.
 */
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface TicketActor {
  user_id: string | null;
  role: "admin" | "employee" | "client" | "bot" | "system";
  name?: string | null;
  email?: string | null;
}

export interface CreateTicketInput {
  owner_user_id: string | null;
  account_id?: string | null;
  subject: string;
  description: string;
  category?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  source?: string;
  client_email?: string | null;
  client_name?: string | null;
  related_order_id?: string | null;
  idempotency_key?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ReplyTicketInput {
  ticket_id: string;
  content: string;
  is_internal_note?: boolean;
  email_message_id?: string | null;
  subject?: string | null;
  attachments?: unknown[];
  idempotency_key?: string | null;
}

export interface TransitionInput {
  ticket_id: string;
  to_status: "open" | "pending" | "in_progress" | "waiting_customer" | "resolved" | "closed" | "cancelled";
  reason: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

// ---------- Audit + email enqueue helpers (best-effort, post-commit) ----------
async function auditTicket(admin: SupabaseClient, action: string, ticketId: string, actor: TicketActor, payload: Record<string, unknown>) {
  try {
    await admin.from("admin_audit_log").insert({
      action: `ticket.${action}`,
      admin_user_id: actor.user_id,
      target_id: ticketId,
      target_type: "support_ticket",
      details: { role: actor.role, ...payload },
    });
  } catch (_) { /* swallow */ }
}

async function enqueueTicketEmail(admin: SupabaseClient, params: {
  toEmail: string | null;
  templateKey: string;
  vars: Record<string, unknown>;
  dedupeKey: string;
}) {
  if (!params.toEmail) return;
  try {
    await admin.from("email_queue").insert({
      to_email: params.toEmail,
      template_key: params.templateKey,
      template_vars: params.vars,
      event_key: params.dedupeKey,
      idempotency_key: params.dedupeKey,
      entity_type: "support_ticket",
      status: "queued",
      priority: 0,
    });
  } catch (_) { /* dedupe unique index will reject duplicates — expected */ }
}

// ---------- CREATE ----------
export async function createTicket(admin: SupabaseClient, actor: TicketActor, input: CreateTicketInput) {
  if (!input.subject?.trim() || !input.description?.trim()) {
    throw new Error("subject_and_description_required");
  }
  const { data, error } = await admin.rpc("rpc_ticket_create", {
    p_owner_user_id: input.owner_user_id,
    p_account_id: input.account_id ?? null,
    p_subject: input.subject.trim(),
    p_description: input.description.trim(),
    p_category: input.category ?? "general",
    p_priority: input.priority ?? "normal",
    p_source: input.source ?? "core",
    p_created_by_user_id: actor.user_id,
    p_created_by_role: actor.role,
    p_client_email: input.client_email ?? null,
    p_client_name: input.client_name ?? null,
    p_related_order_id: input.related_order_id ?? null,
    p_idempotency_key: input.idempotency_key ?? null,
    p_metadata: input.metadata ?? {},
  });
  if (error) throw new Error(`rpc_ticket_create: ${error.message}`);
  const ticket = Array.isArray(data) ? data[0] : data;

  await auditTicket(admin, "created", ticket.id, actor, {
    ticket_number: ticket.ticket_number, source: input.source, priority: input.priority, category: input.category,
  });
  await enqueueTicketEmail(admin, {
    toEmail: input.client_email ?? null,
    templateKey: "client_ticket_opened",
    vars: {
      subject: input.subject.trim(),
      message: input.description.trim(),
      ticket_number: ticket.ticket_number,
      priority: input.priority ?? "normal",
      first_name: (input.client_name ?? "").split(" ")[0] || "Client",
    },
    dedupeKey: `ticket_created_${ticket.id}`,
  });
  return ticket;
}

// ---------- REPLY ----------
export async function replyTicket(admin: SupabaseClient, actor: TicketActor, input: ReplyTicketInput) {
  if (!input.content?.trim()) throw new Error("content_required");
  const { data, error } = await admin.rpc("rpc_ticket_reply", {
    p_ticket_id: input.ticket_id,
    p_author_user_id: actor.user_id,
    p_author_role: actor.role,
    p_content: input.content.trim(),
    p_is_internal_note: input.is_internal_note ?? false,
    p_sender_name: actor.name ?? null,
    p_sender_email: actor.email ?? null,
    p_email_message_id: input.email_message_id ?? null,
    p_subject: input.subject ?? null,
    p_attachments: input.attachments ?? [],
    p_idempotency_key: input.idempotency_key ?? null,
  });
  if (error) throw new Error(`rpc_ticket_reply: ${error.message}`);
  const reply = Array.isArray(data) ? data[0] : data;

  // Load ticket for email + realtime
  const { data: ticket } = await admin
    .from("support_tickets")
    .select("id,ticket_number,client_email,client_name,user_id,owner_user_id")
    .eq("id", input.ticket_id)
    .single();

  await auditTicket(admin, "reply", input.ticket_id, actor, {
    reply_id: reply.id, is_internal: input.is_internal_note ?? false,
  });

  // Notify client only when staff/bot replies publicly
  if (!input.is_internal_note && actor.role !== "client" && ticket?.client_email) {
    await enqueueTicketEmail(admin, {
      toEmail: ticket.client_email,
      templateKey: "client_ticket_replied",
      vars: {
        ticket_number: ticket.ticket_number,
        reply: input.content.trim(),
        first_name: (ticket.client_name ?? "").split(" ")[0] || "Client",
      },
      dedupeKey: `ticket_reply_${reply.id}`,
    });
  }
  return reply;
}

// ---------- TRANSITION ----------
export async function transitionTicket(admin: SupabaseClient, actor: TicketActor, input: TransitionInput) {
  if (!input.reason || input.reason.trim().length < 3) throw new Error("reason_required");
  const { data, error } = await admin.rpc("rpc_ticket_transition", {
    p_ticket_id: input.ticket_id,
    p_to_status: input.to_status,
    p_actor_user_id: actor.user_id,
    p_actor_role: actor.role,
    p_reason: input.reason.trim(),
    p_source: input.source ?? "core",
    p_metadata: input.metadata ?? {},
  });
  if (error) throw new Error(`rpc_ticket_transition: ${error.message}`);
  const ticket = Array.isArray(data) ? data[0] : data;

  await auditTicket(admin, `transition.${input.to_status}`, input.ticket_id, actor, { reason: input.reason });

  if (input.to_status === "resolved" && ticket?.client_email) {
    await enqueueTicketEmail(admin, {
      toEmail: ticket.client_email,
      templateKey: "client_ticket_resolved",
      vars: { ticket_number: ticket.ticket_number, first_name: (ticket.client_name ?? "").split(" ")[0] || "Client" },
      dedupeKey: `ticket_resolved_${ticket.id}`,
    });
  }
  return ticket;
}

// ---------- PARTICIPANT ----------
export async function addParticipant(admin: SupabaseClient, actor: TicketActor, input: {
  ticket_id: string; user_id: string; user_email?: string | null; user_name?: string | null;
  role?: string; can_reply?: boolean; can_reassign?: boolean;
}) {
  const { data, error } = await admin.rpc("rpc_ticket_add_participant", {
    p_ticket_id: input.ticket_id, p_user_id: input.user_id,
    p_user_email: input.user_email ?? null, p_user_name: input.user_name ?? null,
    p_role: input.role ?? "participant",
    p_can_reply: input.can_reply ?? true, p_can_reassign: input.can_reassign ?? false,
    p_added_by: actor.user_id,
  });
  if (error) throw new Error(`rpc_ticket_add_participant: ${error.message}`);
  await auditTicket(admin, "participant_added", input.ticket_id, actor, { participant_user_id: input.user_id });
  return Array.isArray(data) ? data[0] : data;
}

// ---------- AI SCHEDULE (support-email-inbound) ----------
export async function setTicketAiSchedule(admin: SupabaseClient, ticketId: string, scheduledAt: Date) {
  const { data, error } = await admin.rpc("rpc_ticket_set_ai_schedule", {
    p_ticket_id: ticketId,
    p_ai_scheduled_at: scheduledAt.toISOString(),
  });
  if (error) throw new Error(`rpc_ticket_set_ai_schedule: ${error.message}`);
  return Array.isArray(data) ? data[0] : data;
}

// ---------- AI RESULT (support-ai-responder) ----------
export async function applyAiResult(admin: SupabaseClient, input: {
  ticket_id: string;
  outcome: "ai_replied" | "escalated";
  ai_response: string;
  ai_confidence: number; // 0..1
  category: string;
  escalated_reason?: string | null;
  internal_notes?: string | null;
}) {
  const { data, error } = await admin.rpc("rpc_ticket_apply_ai_result", {
    p_ticket_id: input.ticket_id,
    p_outcome: input.outcome,
    p_ai_response: input.ai_response,
    p_ai_confidence: input.ai_confidence,
    p_category: input.category,
    p_escalated_reason: input.escalated_reason ?? null,
    p_internal_notes: input.internal_notes ?? null,
  });
  if (error) throw new Error(`rpc_ticket_apply_ai_result: ${error.message}`);
  return Array.isArray(data) ? data[0] : data;
}
