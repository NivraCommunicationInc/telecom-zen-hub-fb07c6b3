/**
 * Canonical communication gateway wrapper (edge functions)
 * --------------------------------------------------------
 * Module 40 — Phase B.1
 *
 * SINGLE DOOR: all edge functions MUST enqueue outbound communications
 * (email / sms / notification) through this wrapper. Direct inserts into
 * `email_queue`, `sms_queue` or `notification_outbox` are audited and will
 * be blocked once `enforce_single_door=true` is flipped.
 *
 * Usage:
 *   import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
 *
 *   await enqueueCommunication(supabase, {
 *     channel: "email",
 *     templateKey: "order-confirmation",
 *     recipient: "client@example.com",
 *     idempotencyKey: `order-confirmation-${orderId}`,
 *     templateVars: { order_id: orderId },
 *   });
 *
 * The `supabase` parameter must be a service-role client so the RPC can run
 * under SECURITY DEFINER without RLS interference.
 */

// deno-lint-ignore no-explicit-any
type SupabaseLike = { rpc: (fn: string, args: Record<string, any>) => Promise<{ data: any; error: any }> };

export type CommunicationChannel = "email" | "sms" | "notification";
export type CommunicationCategory = "transactional" | "marketing" | "billing" | "operational";

export interface EnqueueCommunicationInput {
  channel: CommunicationChannel;
  templateKey: string;
  recipient: string;
  idempotencyKey: string;

  templateVars?: Record<string, unknown>;
  clientId?: string | null;
  category?: CommunicationCategory;
  actorUserId?: string | null;
  actorRole?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  correlationId?: string | null;
  reason?: string | null;

  subject?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
  cc?: string[] | null;
  bcc?: string[] | null;
  replyTo?: string | null;
  attachments?: unknown[] | null;
  priority?: number;
  scheduledFor?: string | Date | null;
  toName?: string | null;
}

export interface EnqueueCommunicationResult {
  queued: boolean;
  duplicate?: boolean;
  decision: string;
  reason?: string;
  correlation_id: string;
  queue_row_id?: string;
}

function toIso(v: string | Date | null | undefined): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : v;
}

export async function enqueueCommunication(
  supabase: SupabaseLike,
  input: EnqueueCommunicationInput,
): Promise<EnqueueCommunicationResult> {
  if (!input.idempotencyKey || input.idempotencyKey.length < 8) {
    throw new Error("enqueueCommunication: idempotencyKey required (min 8 chars)");
  }

  const { data, error } = await supabase.rpc("rpc_communication_enqueue", {
    p_channel: input.channel,
    p_template_key: input.templateKey,
    p_recipient: input.recipient,
    p_template_vars: input.templateVars ?? {},
    p_idempotency_key: input.idempotencyKey,
    p_client_id: input.clientId ?? null,
    p_category: input.category ?? "transactional",
    p_actor_user_id: input.actorUserId ?? null,
    p_actor_role: input.actorRole ?? null,
    p_entity_type: input.entityType ?? null,
    p_entity_id: input.entityId ?? null,
    p_correlation_id: input.correlationId ?? null,
    p_reason: input.reason ?? null,
    p_subject: input.subject ?? null,
    p_body_html: input.bodyHtml ?? null,
    p_body_text: input.bodyText ?? null,
    p_cc: input.cc ?? null,
    p_bcc: input.bcc ?? null,
    p_reply_to: input.replyTo ?? null,
    p_attachments: input.attachments ?? null,
    p_priority: input.priority ?? 0,
    p_scheduled_for: toIso(input.scheduledFor ?? null),
    p_to_name: input.toName ?? null,
  });

  if (error) throw error;
  return data as EnqueueCommunicationResult;
}

/**
 * Convenience shortcut for inline HTML emails (no template registry entry).
 * The email_queue row keeps `template_key='inline-html'` for observability;
 * downstream consumers must render `body_html`/`body_text` directly.
 */
export async function enqueueInlineEmail(
  supabase: SupabaseLike,
  args: {
    to: string;
    subject: string;
    bodyHtml: string;
    bodyText?: string;
    idempotencyKey: string;
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
    attachments?: unknown[];
    clientId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    category?: CommunicationCategory;
    priority?: number;
    scheduledFor?: string | Date | null;
    actorUserId?: string | null;
    actorRole?: string | null;
  },
): Promise<EnqueueCommunicationResult> {
  return enqueueCommunication(supabase, {
    channel: "email",
    templateKey: "inline-html",
    recipient: args.to,
    idempotencyKey: args.idempotencyKey,
    subject: args.subject,
    bodyHtml: args.bodyHtml,
    bodyText: args.bodyText ?? null,
    cc: args.cc ?? null,
    bcc: args.bcc ?? null,
    replyTo: args.replyTo ?? null,
    attachments: args.attachments ?? null,
    clientId: args.clientId ?? null,
    entityType: args.entityType ?? null,
    entityId: args.entityId ?? null,
    category: args.category ?? "transactional",
    priority: args.priority ?? 0,
    scheduledFor: args.scheduledFor ?? null,
    actorUserId: args.actorUserId ?? null,
    actorRole: args.actorRole ?? null,
  });
}
